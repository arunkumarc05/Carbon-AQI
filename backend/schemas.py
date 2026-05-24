from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

# AQI Schemas
class AQIRecord(BaseModel):
    city_id: str
    pm25: float
    pm10: float
    no2: float
    o3: float
    co2_ppm: Optional[float] = None
    aqi_score: float

class AQIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    record_id: UUID
    city_id: str
    pm25: float
    pm10: float
    no2: float
    o3: float
    aqi_score: float
    recorded_at: datetime
    risk_level: Optional[str] = None

# Carbon Footprint Schemas
class CarbonInput(BaseModel):
    transport_km: float
    transport_type: str  # car/bus/bike/train
    energy_kwh: float
    diet_type: str  # veg/non-veg/vegan

class CarbonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    footprint_id: UUID
    transport_emission: float
    energy_emission: float
    diet_emission: float
    total_emission: float

# ML Prediction Schemas
class MLPredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    prediction_id: UUID
    record_id: UUID
    predicted_aqi: float
    risk_level: str
    model_version: str

# RL Strategy Schemas
class StrategyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    strategy_id: UUID
    strategy_name: str
    description: str
    rl_reward: float

# Chatbot Schemas
class ChatbotRequest(BaseModel):
    message: str
    language: str = 'en'

class ChatbotResponse(BaseModel):
    response: str
    language: str

# Feedback Schemas
class FeedbackCreate(BaseModel):
    subject: str
    message: str

class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    feedback_id: UUID
    subject: str
    status: str
    created_at: datetime

# User Schemas
class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    firebase_uid: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    user_id: UUID
    email: str
    name: str
    role: str
    preferred_language: str

# City Schemas
class CityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    city_id: str
    city_name: str
    country: str
    latitude: float
    longitude: float

# Comparison Schemas
class ComparisonRequest(BaseModel):
    city1_id: str
    city2_id: str