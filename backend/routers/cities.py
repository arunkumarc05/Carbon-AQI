from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Dict, Any
import uuid

from database import get_db
from models import City, AirQualityData, MLPrediction, CityComparison, User
from schemas import CityResponse
from routers.auth import verify_firebase_token, get_or_create_user

router = APIRouter()

@router.get("/list", response_model=List[CityResponse])
async def get_all_cities(db: Session = Depends(get_db)):
    """Return all cities from cities table"""
    
    cities = db.query(City).all()
    
    result = []
    for city in cities:
        result.append(CityResponse(
            city_id=str(city.city_id),
            city_name=city.city_name,
            country=city.country,
            latitude=city.latitude,
            longitude=city.longitude
        ))
    
    return result

@router.get("/compare")
async def compare_cities(
    city1_id: str = Query(..., description="First city ID"),
    city2_id: str = Query(..., description="Second city ID"),
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Compare AQI data between two cities and save comparison"""
    
    try:
        city1_uuid = uuid.UUID(city1_id)
        city2_uuid = uuid.UUID(city2_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid city ID format")
    
    # Get city information
    city1 = db.query(City).filter(City.city_id == city1_uuid).first()
    city2 = db.query(City).filter(City.city_id == city2_uuid).first()
    
    if not city1 or not city2:
        raise HTTPException(status_code=404, detail="One or both cities not found")
    
    # Get latest AQI record for city1
    latest_aqi1 = db.query(AirQualityData, MLPrediction)\
        .join(MLPrediction, AirQualityData.record_id == MLPrediction.record_id, isouter=True)\
        .filter(AirQualityData.city_id == city1_uuid)\
        .order_by(desc(AirQualityData.recorded_at))\
        .first()
    
    # Get latest AQI record for city2
    latest_aqi2 = db.query(AirQualityData, MLPrediction)\
        .join(MLPrediction, AirQualityData.record_id == MLPrediction.record_id, isouter=True)\
        .filter(AirQualityData.city_id == city2_uuid)\
        .order_by(desc(AirQualityData.recorded_at))\
        .first()
    
    # Prepare comparison data  (keys match frontend expectations)
    city1_data = {
        "city_id": city1_id,
        "name": city1.city_name,
        "country": city1.country,
        "state": None,
        "aqi_value": latest_aqi1[0].aqi_score if latest_aqi1 else None,
        "risk_level": latest_aqi1[1].risk_level if latest_aqi1 and latest_aqi1[1] else None,
        "pm25": latest_aqi1[0].pm25 if latest_aqi1 else None,
        "pm10": latest_aqi1[0].pm10 if latest_aqi1 else None,
        "no2":  latest_aqi1[0].no2  if latest_aqi1 else None,
        "so2":  latest_aqi1[0].so2  if latest_aqi1 else None,
        "co":   latest_aqi1[0].co   if latest_aqi1 else None,
        "o3":   latest_aqi1[0].o3   if latest_aqi1 else None,
        "recorded_at": latest_aqi1[0].recorded_at if latest_aqi1 else None
    }

    city2_data = {
        "city_id": city2_id,
        "name": city2.city_name,
        "country": city2.country,
        "state": None,
        "aqi_value": latest_aqi2[0].aqi_score if latest_aqi2 else None,
        "risk_level": latest_aqi2[1].risk_level if latest_aqi2 and latest_aqi2[1] else None,
        "pm25": latest_aqi2[0].pm25 if latest_aqi2 else None,
        "pm10": latest_aqi2[0].pm10 if latest_aqi2 else None,
        "no2":  latest_aqi2[0].no2  if latest_aqi2 else None,
        "so2":  latest_aqi2[0].so2  if latest_aqi2 else None,
        "co":   latest_aqi2[0].co   if latest_aqi2 else None,
        "o3":   latest_aqi2[0].o3   if latest_aqi2 else None,
        "recorded_at": latest_aqi2[0].recorded_at if latest_aqi2 else None
    }
    
    # Save comparison to database
    user = get_or_create_user(token_data, db)
    
    comparison = CityComparison(
        user_id=user.user_id,
        city1_id=city1_uuid,
        city2_id=city2_uuid
    )
    db.add(comparison)
    db.commit()
    
    return {
        "city1": city1_data,
        "city2": city2_data,
        "comparison_id": str(comparison.comparison_id),
        "compared_at": comparison.compared_at
    }