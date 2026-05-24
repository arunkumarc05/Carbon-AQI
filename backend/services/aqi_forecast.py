import uuid as uuid_mod
import numpy as np
from datetime import datetime, timedelta
from xgboost import XGBRegressor

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import SessionLocal
from models import AQIHistory

WINDOW = 3


def _risk_level(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Hazardous"


def get_forecast(city_id: str) -> dict:
    try:
        city_uuid = uuid_mod.UUID(city_id)
    except ValueError:
        return {"error": "Invalid city_id format"}

    db = SessionLocal()
    try:
        rows = (
            db.query(AQIHistory.aqi_score, AQIHistory.recorded_at)
            .filter(AQIHistory.city_id == city_uuid)
            .filter(AQIHistory.aqi_score.isnot(None))
            .order_by(AQIHistory.recorded_at.desc())
            .limit(21)
            .all()
        )
    finally:
        db.close()

    if len(rows) < 6:
        return {"error": "Insufficient history data"}

    # Oldest-first AQI values
    values = [float(r.aqi_score) for r in reversed(rows)]

    # Build sliding-window training data
    X, y = [], []
    for i in range(WINDOW, len(values)):
        X.append(values[i - WINDOW: i])
        y.append(values[i])

    model = XGBRegressor(n_estimators=100, learning_rate=0.1, max_depth=3)
    model.fit(np.array(X), np.array(y))

    # Iterative 7-day prediction
    window = values[-WINDOW:]
    predictions = []
    today = datetime.utcnow().date()

    for day in range(1, 8):
        pred = float(model.predict(np.array([window]))[0])
        pred = round(max(0.0, pred), 1)
        predictions.append({
            "day":           day,
            "date":          (today + timedelta(days=day)).strftime("%Y-%m-%d"),
            "predicted_aqi": pred,
            "risk_level":    _risk_level(pred),
        })
        window = window[1:] + [pred]

    aqi_values = [p["predicted_aqi"] for p in predictions]
    peak_aqi = max(aqi_values)
    peak_day = aqi_values.index(peak_aqi) + 1

    early_avg = sum(aqi_values[:3]) / 3
    late_avg  = sum(aqi_values[4:]) / 3
    diff = late_avg - early_avg
    trend = "increasing" if diff > 10 else "decreasing" if diff < -10 else "stable"

    return {
        "city_id":       city_id,
        "forecast":      predictions,
        "peak_aqi":      round(peak_aqi, 1),
        "peak_day":      peak_day,
        "trend":         trend,
        "days_above_200": sum(1 for v in aqi_values if v > 200),
        "days_above_300": sum(1 for v in aqi_values if v > 300),
        "model":         "xgboost_v1",
    }
