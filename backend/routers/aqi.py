from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any
from datetime import datetime, timedelta
import uuid

from database import get_db
from models import AirQualityData, MLPrediction, MitigationStrategy, City, AQIHistory
from schemas import AQIRecord, AQIResponse
from routers.auth import verify_firebase_token

# Import ML functions
from ml.predict import predict_aqi_risk
from ml.rl_agent import get_mitigation_strategy

from services.live_aqi import fetch_live_aqi, fetch_all_cities_live

router = APIRouter()

@router.post("/record", response_model=AQIResponse)
async def save_aqi_record(
    aqi_data: AQIRecord,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Save a new AQI reading with ML prediction and RL strategy"""
    
    # Find city by city_id
    city = db.query(City).filter(City.city_id == uuid.UUID(aqi_data.city_id)).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    
    # Create new AQI record
    new_record = AirQualityData(
        city_id=uuid.UUID(aqi_data.city_id),
        pm25=aqi_data.pm25,
        pm10=aqi_data.pm10,
        no2=aqi_data.no2,
        o3=aqi_data.o3,
        co2_ppm=aqi_data.co2_ppm,
        aqi_score=aqi_data.aqi_score
    )
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    # Call ML prediction
    try:
        ml_result = predict_aqi_risk(
            aqi_data.pm25, 
            aqi_data.pm10, 
            aqi_data.no2, 
            aqi_data.co2_ppm, 
            0,  # SO2
            aqi_data.aqi_score
        )
        
        # Save ML prediction
        ml_prediction = MLPrediction(
            record_id=new_record.record_id,
            predicted_aqi=ml_result['predicted_aqi'],
            risk_level=ml_result['risk_level'],
            model_version=ml_result.get('model_version', 'v1.0')
        )
        db.add(ml_prediction)
        
        # If risk level is High, call RL strategy
        if ml_result['risk_level'].lower() == 'high':
            try:
                rl_result = get_mitigation_strategy(
                    aqi_data.pm25, 
                    aqi_data.pm10, 
                    aqi_data.no2, 
                    aqi_data.co2_ppm, 
                    0, 
                    aqi_data.aqi_score
                )
                
                # Save RL strategy
                strategy = MitigationStrategy(
                    record_id=new_record.record_id,
                    strategy_name=rl_result['strategy_name'],
                    description=rl_result['description'],
                    rl_reward=rl_result.get('rl_reward', 0.0)
                )
                db.add(strategy)
            except Exception as e:
                print(f"RL strategy error: {e}")
        
        db.commit()
        
        # Prepare response
        response_data = {
            "record_id": new_record.record_id,
            "city_id": aqi_data.city_id,
            "pm25": new_record.pm25,
            "pm10": new_record.pm10,
            "no2": new_record.no2,
            "o3": new_record.o3,
            "aqi_score": new_record.aqi_score,
            "recorded_at": new_record.recorded_at,
            "risk_level": ml_result['risk_level']
        }
        
        return AQIResponse(**response_data)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"ML prediction failed: {str(e)}")

@router.get("/city/{city_id}", response_model=List[AQIResponse])
async def get_city_aqi_records(
    city_id: str,
    db: Session = Depends(get_db)
):
    """Get latest 30 AQI records for a city with ML predictions"""
    
    try:
        city_uuid = uuid.UUID(city_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid city_id format")
    
    records = db.query(AirQualityData, MLPrediction)\
        .join(MLPrediction, AirQualityData.record_id == MLPrediction.record_id, isouter=True)\
        .filter(AirQualityData.city_id == city_uuid)\
        .order_by(desc(AirQualityData.recorded_at))\
        .limit(30)\
        .all()
    
    result = []
    for record, prediction in records:
        result.append(AQIResponse(
            record_id=record.record_id,
            city_id=city_id,
            pm25=record.pm25,
            pm10=record.pm10,
            no2=record.no2,
            o3=record.o3,
            aqi_score=record.aqi_score,
            recorded_at=record.recorded_at,
            risk_level=prediction.risk_level if prediction else None
        ))
    
    return result

@router.get("/cities")
async def get_all_cities_latest_aqi(db: Session = Depends(get_db)):
    """Get latest AQI for all cities for dashboard map"""
    
    subq = db.query(
        AirQualityData.city_id,
        func.max(AirQualityData.recorded_at).label('latest_date')
    ).group_by(AirQualityData.city_id).subquery()
    
    cities_data = db.query(
        City.city_id,
        City.city_name,
        AirQualityData.aqi_score,
        AirQualityData.pm25,
        AirQualityData.pm10,
        AirQualityData.no2,
        AirQualityData.o3,
        MLPrediction.risk_level
    ).join(
        AirQualityData, City.city_id == AirQualityData.city_id
    ).join(
        subq,
        (AirQualityData.city_id == subq.c.city_id) &
        (AirQualityData.recorded_at == subq.c.latest_date)
    ).outerjoin(
        MLPrediction, AirQualityData.record_id == MLPrediction.record_id
    ).all()

    result = []
    for city_id, city_name, aqi_score, pm25, pm10, no2, o3, risk_level in cities_data:
        result.append({
            "id": str(city_id),
            "city_id": str(city_id),
            "name": city_name,
            "city_name": city_name,
            "aqi_value": aqi_score,
            "aqi_score": aqi_score,
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "o3": o3,
            "risk_level": risk_level,
            "state": None
        })

    return result

@router.get("/city/{city_id}/latest")
async def get_city_latest_aqi(city_id: str, db: Session = Depends(get_db)):
    """Get single latest AQI record for a city"""

    try:
        city_uuid = uuid.UUID(city_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid city_id format")

    city = db.query(City).filter(City.city_id == city_uuid).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    latest_record = db.query(AirQualityData, MLPrediction)\
        .join(MLPrediction, AirQualityData.record_id == MLPrediction.record_id, isouter=True)\
        .filter(AirQualityData.city_id == city_uuid)\
        .order_by(desc(AirQualityData.recorded_at))\
        .first()
    
    aqi_row, ml_row = latest_record if latest_record else (None, None)

    live = await fetch_live_aqi(city.city_name)
    if live and aqi_row:
        aqi_row.pm25 = live["pm25"]
        aqi_row.pm10 = live["pm10"]
        aqi_row.no2  = live["no2"]
        aqi_row.co   = live["co"]
        aqi_row.so2  = live["so2"]
        aqi_row.o3   = live["o3"]
        db.commit()
        db.refresh(aqi_row)

    return {
        "record_id": str(aqi_row.record_id) if aqi_row else None,
        "city_id": city_id,
        "city_name": city.city_name,
        "country": city.country,
        "aqi_score": aqi_row.aqi_score if aqi_row else None,
        "pm25": aqi_row.pm25 if aqi_row else None,
        "pm10": aqi_row.pm10 if aqi_row else None,
        "no2": aqi_row.no2 if aqi_row else None,
        "o3": aqi_row.o3 if aqi_row else None,
        "co2_ppm": aqi_row.co2_ppm if aqi_row else None,
        "risk_level": ml_row.risk_level if ml_row else None,
        "recorded_at": aqi_row.recorded_at if aqi_row else None,
    }

@router.get("/history/{city_id}")
async def get_city_history(city_id: str, db: Session = Depends(get_db)):
    """Get 90 days history for chart (by city_id)"""
    try:
        city_uuid = uuid.UUID(city_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid city_id format")
    
    ninety_days_ago = datetime.now() - timedelta(days=90)
    
    history = db.query(
        func.date(AirQualityData.recorded_at).label('date'),
        func.avg(AirQualityData.aqi_score).label('avg_aqi')
    ).filter(
        AirQualityData.city_id == city_uuid,
        AirQualityData.recorded_at >= ninety_days_ago
    ).group_by(
        func.date(AirQualityData.recorded_at)
    ).order_by('date').all()
    
    return [{"date": d.isoformat(), "avg_aqi": float(a)} for d, a in history]

@router.get("/history_by_name/{city_name}")
async def get_city_history_by_name(city_name: str, days: int = 7, db: Session = Depends(get_db)):
    """Get historical AQI readings for a city by name for last N days (from AQIHistory)"""
    timeframe = datetime.now() - timedelta(days=days)
    history = db.query(AQIHistory).filter(
        AQIHistory.city_name == city_name,
        AQIHistory.recorded_at >= timeframe
    ).order_by(AQIHistory.recorded_at.asc()).all()
    
    return [{
        "recorded_at": r.recorded_at.isoformat(),
        "aqi_score": r.aqi_score,
        "pm25": r.pm25,
        "pm10": r.pm10,
        "risk_level": r.risk_level
    } for r in history]

@router.get("/live-status")
async def live_status():
    import os
    key = os.getenv("OPENWEATHER_API_KEY")
    return {"live_api": bool(key), "message": "Live data active" if key else "Using cached seed data"}