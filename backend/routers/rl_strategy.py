from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uuid

from database import get_db
from models import MitigationStrategy, AirQualityData
from routers.auth import verify_firebase_token

router = APIRouter()

@router.get("/strategies")
async def get_all_strategies(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all RL mitigation strategies"""
    strategies = db.query(MitigationStrategy).all()
    
    result = []
    for strategy in strategies:
        result.append({
            "strategy_id": str(strategy.strategy_id),
            "record_id": str(strategy.record_id),
            "strategy_name": strategy.strategy_name,
            "description": strategy.description,
            "rl_reward": strategy.rl_reward,
            "created_at": strategy.created_at
        })
    
    return result

@router.get("/strategies/{record_id}")
async def get_strategy_by_record(
    record_id: str,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get RL strategy for a specific record"""
    try:
        record_uuid = uuid.UUID(record_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid record_id format")
    
    strategy = db.query(MitigationStrategy).filter(MitigationStrategy.record_id == record_uuid).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    return {
        "strategy_id": str(strategy.strategy_id),
        "record_id": str(strategy.record_id),
        "strategy_name": strategy.strategy_name,
        "description": strategy.description,
        "rl_reward": strategy.rl_reward,
        "created_at": strategy.created_at
    }

@router.get("/strategies/high-risk")
async def get_high_risk_strategies(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get strategies for high-risk AQI records"""
    # Join with air_quality_data to get high AQI records
    strategies = db.query(MitigationStrategy, AirQualityData)\
        .join(AirQualityData, MitigationStrategy.record_id == AirQualityData.record_id)\
        .filter(AirQualityData.aqi_score > 150)\
        .order_by(AirQualityData.aqi_score.desc())\
        .limit(20)\
        .all()
    
    result = []
    for strategy, aqi_record in strategies:
        result.append({
            "strategy_id": str(strategy.strategy_id),
            "record_id": str(strategy.record_id),
            "strategy_name": strategy.strategy_name,
            "description": strategy.description,
            "rl_reward": strategy.rl_reward,
            "aqi_score": aqi_record.aqi_score,
            "city_id": str(aqi_record.city_id),
            "created_at": strategy.created_at
        })
    
    return result