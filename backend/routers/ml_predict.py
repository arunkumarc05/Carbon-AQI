from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uuid

from database import get_db
from models import MLPrediction, AirQualityData
from routers.auth import verify_firebase_token
from services.aqi_forecast import get_forecast

router = APIRouter()

@router.get("/predictions")
async def get_all_predictions(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all ML predictions"""
    predictions = db.query(MLPrediction).all()
    
    result = []
    for pred in predictions:
        result.append({
            "prediction_id": str(pred.prediction_id),
            "record_id": str(pred.record_id),
            "predicted_aqi": pred.predicted_aqi,
            "risk_level": pred.risk_level,
            "model_version": pred.model_version,
            "created_at": pred.created_at
        })
    
    return result

@router.get("/predictions/{record_id}")
async def get_prediction_by_record(
    record_id: str,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get ML prediction for a specific record"""
    try:
        record_uuid = uuid.UUID(record_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid record_id format")

    prediction = db.query(MLPrediction).filter(MLPrediction.record_id == record_uuid).first()

    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    return {
        "prediction_id": str(prediction.prediction_id),
        "record_id": str(prediction.record_id),
        "predicted_aqi": prediction.predicted_aqi,
        "risk_level": prediction.risk_level,
        "model_version": prediction.model_version,
        "created_at": prediction.created_at
    }

@router.get("/forecast/{city_id}")
async def get_aqi_forecast(
    city_id: str,
    _token_data: dict = Depends(verify_firebase_token),
):
    """Get 7-day XGBoost AQI forecast for a city (path param)"""
    result = get_forecast(city_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@router.get("/forecast")
async def get_aqi_forecast_query(
    city_id: str | None = None,
    _token_data: dict = Depends(verify_firebase_token),
):
    """Get 7-day XGBoost AQI forecast for a city (query param: ?city_id=)"""
    if not city_id:
        raise HTTPException(status_code=400, detail="city_id query parameter is required")
    result = get_forecast(city_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Additional imports required by the orchestration endpoint only
# ─────────────────────────────────────────────────────────────────────────────
from datetime import datetime
from sqlalchemy import desc as _desc

from models import AirQualityData, City
from ml.predict import predict_aqi_risk
from ml.rl_agent import get_enhanced_strategy
from services.alert_engine import evaluate_and_alert
from services.live_aqi import fetch_live_aqi


@router.get("/smart-analysis/{city_id}")
async def smart_analysis(
    city_id: str,
    db: Session = Depends(get_db),
):
    """
    Orchestrates XGBoost forecast + enhanced RL strategy + alert evaluation
    for a single city and returns a unified analysis payload.

    Steps
    ─────
    1. Validate city_id and fetch current AQI record + city metadata from DB
    2. Run CPCB formula ML prediction on current pollutant readings
    3. Run 7-day XGBoost forecast via services/aqi_forecast
    4. Run enhanced RL strategy (forecast-aware) via ml/rl_agent
    5. Evaluate alert thresholds and persist any triggered alerts
    6. Return combined response
    """
    # ── 1. Validate city_id UUID ──────────────────────────────────────────────
    try:
        city_uuid = uuid.UUID(city_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid city_id format")

    # ── Fetch city metadata ───────────────────────────────────────────────────
    city = db.query(City).filter(City.city_id == city_uuid).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    # ── Fetch latest AQI record ───────────────────────────────────────────────
    latest = (
        db.query(AirQualityData)
        .filter(AirQualityData.city_id == city_uuid)
        .order_by(_desc(AirQualityData.recorded_at))
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No AQI data found for this city")

    # Build current_data dict shared across ML, RL, and alert steps
    current_data = {
        "city_id":   city_id,
        "city_name": city.city_name,
        "pm25":      latest.pm25      or 0.0,
        "pm10":      latest.pm10      or 0.0,
        "no2":       latest.no2       or 0.0,
        "co":        latest.co        or 0.0,
        "so2":       latest.so2       or 0.0,
        "o3":        latest.o3        or 0.0,
        "aqi_value": latest.aqi_score or 0.0,
    }
    current_aqi = current_data["aqi_value"]

    # ── Enrich with live pollutant readings (non-fatal if API unavailable) ────
    try:
        live = await fetch_live_aqi(city.city_name)
        if live:
            current_data["pm25"] = live.get("pm25") or current_data["pm25"]
            current_data["pm10"] = live.get("pm10") or current_data["pm10"]
            current_data["no2"]  = live.get("no2")  or current_data["no2"]
            current_data["co"]   = live.get("co")   or current_data["co"]
            current_data["so2"]  = live.get("so2")  or current_data["so2"]
            current_data["o3"]   = live.get("o3")   or current_data["o3"]
    except Exception:
        pass

    # ── 2. CPCB formula ML prediction ─────────────────────────────────────────
    try:
        ml_result = predict_aqi_risk(
            current_data["pm25"],
            current_data["pm10"],
            current_data["no2"],
            current_data["co"],
            current_data["so2"],
            current_data["o3"],
        )
        ml_prediction = {
            "risk_level": ml_result["risk_level"],
            "confidence": ml_result["confidence"],
            "method":     "CPCB_formula",
        }
    except Exception as exc:
        ml_prediction = {
            "risk_level": "Unknown",
            "confidence": 0.0,
            "method":     "CPCB_formula",
            "error":      str(exc),
        }

    # ── 3. 7-day XGBoost forecast ─────────────────────────────────────────────
    forecast_data = get_forecast(city_id)
    # If "error" is in forecast_data, we allow it to pass through so the UI can gracefully degrade.

    # ── 4. Enhanced RL strategy (forecast-aware) ──────────────────────────────
    try:
        strategy_raw = get_enhanced_strategy(current_data, forecast_data)
    except Exception as exc:
        strategy_raw = {
            "action_id":       0,
            "strategy_name":   "Issue Health Advisory",
            "description":     "Fallback — RL model error",
            "rl_reward":       0.0,
            "urgency":         "advisory",
            "trigger_reason":  str(exc),
            "forecast_driven": True,
        }

    # Normalize rl_reward (range −2.5 → +2.5) to a 0–100 confidence percentage
    raw_reward = float(strategy_raw.get("rl_reward", 0.0))
    confidence_pct = round(max(0.0, min(100.0, (raw_reward + 2.5) / 5.0 * 100)), 1)

    rl_strategy = {
        "strategy_name":   strategy_raw.get("strategy_name"),
        "description":     strategy_raw.get("description"),
        "urgency":         strategy_raw.get("urgency"),
        "trigger_reason":  strategy_raw.get("trigger_reason"),
        "confidence":      confidence_pct,
        "forecast_driven": strategy_raw.get("forecast_driven", True),
    }

    # ── 5. Alert evaluation ───────────────────────────────────────────────────
    # Augment strategy_raw with current_aqi so alert_engine can read it
    strategy_for_alert = {**strategy_raw, "current_aqi": current_aqi}
    try:
        active_alerts = evaluate_and_alert(
            city_id       = city_id,
            city_name     = city.city_name,
            forecast_data = forecast_data,
            strategy_data = strategy_for_alert,
        )
    except Exception as exc:
        print(f"[smart-analysis] alert_engine error: {exc}")
        active_alerts = []

    return {
        "city_id":            city_id,
        "city_name":          city.city_name,
        "current_aqi":        current_aqi,
        "pm25":               current_data["pm25"] or None,
        "pm10":               current_data["pm10"] or None,
        "no2":                current_data["no2"]  or None,
        "co":                 current_data["co"]   or None,
        "so2":                current_data["so2"]  or None,
        "o3":                 current_data["o3"]   or None,
        "ml_prediction":      ml_prediction,
        "forecast":           forecast_data,
        "rl_strategy":        rl_strategy,
        "active_alerts":      active_alerts,
        "analysis_timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    }