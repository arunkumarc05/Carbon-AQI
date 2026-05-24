"""
backend/services/alert_engine.py
─────────────────────────────────────────────────────────────────────────────
Smart Alert System — runs automatically whenever a forecast is generated.

Public API
──────────
  evaluate_and_alert(city_id, city_name, forecast_data, strategy_data) → list[dict]
  get_active_alerts_for_city(city_id)                                   → list[dict]
  get_user_alerts(user_id)                                              → list[dict]
"""

from __future__ import annotations

import sys
import os
import uuid as uuid_mod

# ── bootstrap: allow `from models import …` regardless of cwd ────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import SessionLocal
from models import CityAlert, AlertNotification, CityComparison

# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

# Severity order used when sorting query results
_SEVERITY_ORDER = {"CRITICAL": 0, "WARNING": 1, "ADVISORY": 2}


def _to_dict(alert: CityAlert) -> dict:
    """Serialize a CityAlert ORM row to a plain dict."""
    return {
        "alert_id":      str(alert.alert_id),
        "city_id":       str(alert.city_id),
        "city_name":     alert.city_name,
        "alert_type":    alert.alert_type,
        "message":       alert.message,
        "aqi_value":     alert.aqi_value,
        "strategy_name": alert.strategy_name,
        "forecast_peak": alert.forecast_peak,
        "triggered_at":  alert.triggered_at.isoformat() if alert.triggered_at else None,
        "is_active":     alert.is_active,
    }


def _build_message(
    alert_type: str,
    city_name:  str,
    current_aqi: float,
    forecast_data: dict,
) -> str:
    """Return a human-readable alert message."""
    peak_aqi = forecast_data.get("peak_aqi", current_aqi)
    peak_day = forecast_data.get("peak_day", 1)
    trend    = forecast_data.get("trend", "stable")

    if alert_type == "CRITICAL":
        if current_aqi > 300:
            return (
                f"{city_name} — CRITICAL: Current AQI is {round(current_aqi)}, "
                f"exceeding the hazardous threshold."
            )
        return (
            f"{city_name} — CRITICAL: AQI forecast to reach "
            f"{round(peak_aqi)} on Day {peak_day} (hazardous level)."
        )

    if alert_type == "WARNING":
        days_above_200 = forecast_data.get("days_above_200", 0)
        if trend == "increasing":
            return (
                f"{city_name} — WARNING: AQI forecast to reach "
                f"{round(peak_aqi)} on Day {peak_day} with an increasing trend."
            )
        return (
            f"{city_name} — WARNING: AQI forecast above 200 for "
            f"{days_above_200} day(s) — sustained poor air quality expected."
        )

    # ADVISORY
    return (
        f"{city_name} — ADVISORY: AQI rising trend detected. "
        f"Peak forecast at {round(peak_aqi)} on Day {peak_day}. "
        f"Take precautionary measures."
    )


# ─────────────────────────────────────────────────────────────────────────────
# send_alert_notification
# ─────────────────────────────────────────────────────────────────────────────

def send_alert_notification(alert: CityAlert, db) -> None:
    """
    Persist a lightweight notification row for frontend polling and log to
    the console.  Email/SMS hook is prepared but disabled — enable by
    uncommenting the SMTP block and supplying credentials in .env.
    """
    # 1. Console log ─────────────────────────────────────────────────────────
    print(
        f"[ALERT] {alert.city_name} — {alert.alert_type} — "
        f"AQI forecast {alert.forecast_peak} | {alert.message}"
    )

    # 2. DB notification row (polled by frontend) ─────────────────────────────
    notification = AlertNotification(
        alert_id   = alert.alert_id,
        city_name  = alert.city_name,
        alert_type = alert.alert_type,
        message    = alert.message,
    )
    db.add(notification)
    # Caller is responsible for the commit.

    # 3. Email hook (disabled — add SMTP credentials to .env to enable) ───────
    # import smtplib, os
    # from email.message import EmailMessage
    # smtp_host = os.getenv("SMTP_HOST")
    # if smtp_host:
    #     msg = EmailMessage()
    #     msg["Subject"] = f"[Carbon AQI] {alert.alert_type} — {alert.city_name}"
    #     msg["From"]    = os.getenv("SMTP_FROM", "alerts@carbonaqi.io")
    #     msg["To"]      = os.getenv("ALERT_EMAIL_TO", "")
    #     msg.set_content(alert.message)
    #     with smtplib.SMTP(smtp_host, int(os.getenv("SMTP_PORT", 587))) as s:
    #         s.starttls()
    #         s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS"))
    #         s.send_message(msg)


# ─────────────────────────────────────────────────────────────────────────────
# evaluate_and_alert
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_and_alert(
    city_id:       str,
    city_name:     str,
    forecast_data: dict,
    strategy_data: dict,
) -> list[dict]:
    """
    Evaluate forecast data against alert thresholds and persist any triggered
    alerts to the database.

    Alert trigger conditions
    ────────────────────────
    CRITICAL  → current AQI > 300  OR  any forecast day has predicted_aqi > 300
    WARNING   → current AQI > 200  OR  days_above_200 >= 3
    ADVISORY  → trend == "increasing"  AND  peak_aqi > 150

    Parameters
    ──────────
    city_id       : UUID string of the city
    city_name     : Human-readable city name (e.g. "Delhi")
    forecast_data : dict returned by services/aqi_forecast.get_forecast()
    strategy_data : dict returned by ml/rl_agent.get_enhanced_strategy()

    Returns
    ───────
    List of alert dicts that were actually triggered and inserted.
    """
    # ── Unpack forecast fields ────────────────────────────────────────────────
    forecast_list  = forecast_data.get("forecast", [])
    peak_aqi       = float(forecast_data.get("peak_aqi", 0))
    trend          = forecast_data.get("trend", "stable")
    days_above_200 = int(forecast_data.get("days_above_200", 0))

    # Current AQI: strategy_data carries it (passed through from current_data)
    current_aqi = float(strategy_data.get("current_aqi", 0))

    # Any forecast day exceeding 300?
    any_day_over_300 = any(
        float(d.get("predicted_aqi", 0)) > 300
        for d in forecast_list
    )

    # ── Determine which alert types fire ─────────────────────────────────────
    triggered_types: list[str] = []

    if current_aqi > 300 or any_day_over_300:
        triggered_types.append("CRITICAL")
    if current_aqi > 200 or days_above_200 >= 3:
        triggered_types.append("WARNING")
    if trend == "increasing" and peak_aqi > 150:
        triggered_types.append("ADVISORY")

    # Remove lower severities when CRITICAL fires (avoid noise)
    if "CRITICAL" in triggered_types:
        triggered_types = ["CRITICAL"]

    if not triggered_types:
        return []  # Nothing to alert on

    # ── Parse city UUID ───────────────────────────────────────────────────────
    try:
        city_uuid = uuid_mod.UUID(city_id)
    except ValueError:
        print(f"[alert_engine] Invalid city_id: {city_id}")
        return []

    # ── Persist alerts ────────────────────────────────────────────────────────
    db = SessionLocal()
    inserted: list[dict] = []
    try:
        for alert_type in triggered_types:
            message = _build_message(alert_type, city_name, current_aqi, forecast_data)

            alert = CityAlert(
                city_id       = city_uuid,
                city_name     = city_name,
                alert_type    = alert_type,
                message       = message,
                aqi_value     = current_aqi if current_aqi else None,
                strategy_name = strategy_data.get("strategy_name"),
                forecast_peak = peak_aqi if peak_aqi else None,
                is_active     = True,
            )
            db.add(alert)
            db.flush()  # populate alert.alert_id before notification FK

            send_alert_notification(alert, db)

            inserted.append(_to_dict(alert))

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[alert_engine] DB error: {exc}")
    finally:
        db.close()

    return inserted


# ─────────────────────────────────────────────────────────────────────────────
# get_active_alerts_for_all_cities
# ─────────────────────────────────────────────────────────────────────────────

def get_active_alerts_for_all_cities() -> list[dict]:
    """Return all active alerts across every city, ordered by severity."""
    db = SessionLocal()
    try:
        rows = (
            db.query(CityAlert)
            .filter(CityAlert.is_active == True)  # noqa: E712
            .order_by(CityAlert.triggered_at.desc())
            .all()
        )
        alerts = [_to_dict(r) for r in rows]
    finally:
        db.close()

    alerts.sort(key=lambda a: _SEVERITY_ORDER.get(a["alert_type"], 99))
    return alerts


# ─────────────────────────────────────────────────────────────────────────────
# get_active_alerts_for_city
# ─────────────────────────────────────────────────────────────────────────────

def get_active_alerts_for_city(city_id: str) -> list[dict]:
    """
    Return all active (is_active=True) alerts for the given city, ordered by
    severity (CRITICAL → WARNING → ADVISORY) then by most recent first.

    Parameters
    ──────────
    city_id : UUID string of the city

    Returns
    ───────
    List of alert dicts sorted by severity, newest first within each level.
    """
    try:
        city_uuid = uuid_mod.UUID(city_id)
    except ValueError:
        return []

    db = SessionLocal()
    try:
        rows = (
            db.query(CityAlert)
            .filter(CityAlert.city_id == city_uuid, CityAlert.is_active == True)  # noqa: E712
            .order_by(CityAlert.triggered_at.desc())
            .all()
        )
        alerts = [_to_dict(r) for r in rows]
    finally:
        db.close()

    # Sort by severity order, preserving recency within each level
    alerts.sort(key=lambda a: _SEVERITY_ORDER.get(a["alert_type"], 99))
    return alerts


# ─────────────────────────────────────────────────────────────────────────────
# get_user_alerts
# ─────────────────────────────────────────────────────────────────────────────

def get_user_alerts(user_id: str) -> list[dict]:
    """
    Return active alerts for every city the user has bookmarked via the
    city_comparison table (both city1_id and city2_id are treated as
    subscriptions).  Results are de-duplicated and sorted by severity.

    Parameters
    ──────────
    user_id : UUID string of the authenticated user

    Returns
    ───────
    List of alert dicts across all subscribed cities, sorted by severity.
    """
    try:
        user_uuid = uuid_mod.UUID(user_id)
    except ValueError:
        return []

    db = SessionLocal()
    try:
        # Collect the city UUIDs the user has compared (used as subscriptions)
        comparisons = (
            db.query(CityComparison)
            .filter(CityComparison.user_id == user_uuid)
            .all()
        )

        subscribed_city_ids: set[uuid_mod.UUID] = set()
        for comp in comparisons:
            subscribed_city_ids.add(comp.city1_id)
            subscribed_city_ids.add(comp.city2_id)

        if not subscribed_city_ids:
            return []

        rows = (
            db.query(CityAlert)
            .filter(
                CityAlert.city_id.in_(subscribed_city_ids),
                CityAlert.is_active == True,  # noqa: E712
            )
            .order_by(CityAlert.triggered_at.desc())
            .all()
        )

        alerts = [_to_dict(r) for r in rows]
    finally:
        db.close()

    alerts.sort(key=lambda a: _SEVERITY_ORDER.get(a["alert_type"], 99))
    return alerts
