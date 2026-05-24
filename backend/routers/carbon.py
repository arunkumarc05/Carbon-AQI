from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any
from datetime import datetime

from database import get_db
from models import CarbonFootprint, User
from schemas import CarbonInput, CarbonResponse
from routers.auth import verify_firebase_token, get_or_create_user

# Emission factors (hardcoded constants)
TRANSPORT_FACTORS = {
    "car": 0.21,      # kg CO2 per km
    "bus": 0.089,
    "bike": 0.0,      # bicycle
    "train": 0.041,
    "auto": 0.15      # auto-rickshaw  
}

DIET_FACTORS = {
    "vegan": 1.5,           # kg CO2 per day
    "veg": 2.5,
    "non-veg": 3.3
}

ENERGY_FACTOR = 0.82  # kg CO2 per kWh (India grid emission factor, MoEFCC 2023)

router = APIRouter()

@router.post("/calculate", response_model=CarbonResponse)
async def calculate_carbon_footprint(
    carbon_data: CarbonInput,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Calculate and save carbon footprint for authenticated user"""
    
    # Validate transport type
    if carbon_data.transport_type not in TRANSPORT_FACTORS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid transport type. Must be one of: {list(TRANSPORT_FACTORS.keys())}"
        )
    
    # Validate diet type
    if carbon_data.diet_type not in DIET_FACTORS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid diet type. Must be one of: {list(DIET_FACTORS.keys())}"
        )
    
    # Calculate emissions
    transport_emission = round(carbon_data.transport_km * TRANSPORT_FACTORS[carbon_data.transport_type], 2)
    energy_emission = round(carbon_data.energy_kwh * ENERGY_FACTOR, 2)
    diet_emission = round(DIET_FACTORS[carbon_data.diet_type] * 30, 2)  # monthly
    total_emission = round(transport_emission + energy_emission + diet_emission, 2)
    
    user = get_or_create_user(token_data, db)
    
    # Save to database
    new_footprint = CarbonFootprint(
        user_id=user.user_id,
        transport_emission=transport_emission,
        energy_emission=energy_emission,
        diet_emission=diet_emission,
        total_emission=total_emission
    )
    
    db.add(new_footprint)
    db.commit()
    db.refresh(new_footprint)
    
    return CarbonResponse(
        footprint_id=new_footprint.footprint_id,
        transport_emission=transport_emission,
        energy_emission=energy_emission,
        diet_emission=diet_emission,
        total_emission=total_emission
    )

@router.get("/history")
async def get_carbon_history(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get last 10 carbon footprint records for authenticated user"""
    
    user = get_or_create_user(token_data, db)
    
    # Get last 10 records
    records = db.query(CarbonFootprint)\
        .filter(CarbonFootprint.user_id == user.user_id)\
        .order_by(desc(CarbonFootprint.calculated_at))\
        .limit(10)\
        .all()
    
    result = []
    for record in records:
        result.append({
            "footprint_id": record.footprint_id,
            "transport_emission": record.transport_emission,
            "energy_emission": record.energy_emission,
            "diet_emission": record.diet_emission,
            "total_emission": record.total_emission,
            "calculated_at": record.calculated_at
        })
    
    return result

@router.get("/average")
async def get_average_emission(db: Session = Depends(get_db)):
    """Get average total emission across all users (anonymized benchmark)"""
    
    # Calculate average total emission
    avg_result = db.query(
        func.avg(CarbonFootprint.total_emission).label('average_emission')
    ).scalar()
    
    # Get total number of records for context
    total_records = db.query(CarbonFootprint).count()
    
    # Get total number of unique users
    unique_users = db.query(CarbonFootprint.user_id).distinct().count()
    
    return {
        "average_monthly_emission_kg": round(float(avg_result), 2) if avg_result else 0.0,
        "total_records": total_records,
        "unique_users": unique_users,
        "benchmark_description": "Average monthly carbon footprint across all users in kg CO2"
    }