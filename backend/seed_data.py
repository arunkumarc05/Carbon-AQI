import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from models import City, AirQualityData, MLPrediction, MitigationStrategy
from sqlalchemy import text
import random

db = SessionLocal()

# Clear existing data and patch schema if needed
db.execute(text("DELETE FROM mitigation_strategies"))
db.execute(text("DELETE FROM ml_predictions"))
db.execute(text("DELETE FROM air_quality_data"))
db.execute(text("DELETE FROM city_comparison"))
db.execute(text("DELETE FROM cities"))
db.commit()

# Ensure new columns exist (Postgres syntax)
db.execute(text("ALTER TABLE air_quality_data ADD COLUMN IF NOT EXISTS co FLOAT"))
db.execute(text("ALTER TABLE air_quality_data ADD COLUMN IF NOT EXISTS so2 FLOAT"))
db.execute(text("ALTER TABLE mitigation_strategies ADD COLUMN IF NOT EXISTS action_id INTEGER"))
db.commit()

cities_data = [
    {"city_name": "Mumbai", "country": "India", "latitude": 19.0760, "longitude": 72.8777, "population": 20667656},
    {"city_name": "Delhi", "country": "India", "latitude": 28.6139, "longitude": 77.2090, "population": 32941000},
    {"city_name": "Bangalore", "country": "India", "latitude": 12.9716, "longitude": 77.5946, "population": 12478447},
    {"city_name": "Chennai", "country": "India", "latitude": 13.0827, "longitude": 80.2707, "population": 10971108},
    {"city_name": "Kolkata", "country": "India", "latitude": 22.5726, "longitude": 88.3639, "population": 14850000},
    {"city_name": "Hyderabad", "country": "India", "latitude": 17.3850, "longitude": 78.4867, "population": 10004350},
    {"city_name": "Pune", "country": "India", "latitude": 18.5204, "longitude": 73.8567, "population": 6629347},
    {"city_name": "Ahmedabad", "country": "India", "latitude": 23.0225, "longitude": 72.5714, "population": 8059441},
    {"city_name": "Lucknow", "country": "India", "latitude": 26.8467, "longitude": 80.9462, "population": 3382900},
    {"city_name": "Jaipur", "country": "India", "latitude": 26.9124, "longitude": 75.7873, "population": 3046163},
]

# AQI profiles per city (realistic values based on dataset)
aqi_profiles = {
    "Delhi":     {"pm25": 153, "pm10": 241, "no2": 33,  "co": 1.87, "so2": 64,  "o3": 83},
    "Mumbai":    {"pm25": 62,  "pm10": 98,  "no2": 28,  "co": 1.20, "so2": 22,  "o3": 55},
    "Bangalore": {"pm25": 38,  "pm10": 65,  "no2": 18,  "co": 0.80, "so2": 12,  "o3": 42},
    "Chennai":   {"pm25": 45,  "pm10": 78,  "no2": 22,  "co": 0.95, "so2": 18,  "o3": 48},
    "Kolkata":   {"pm25": 95,  "pm10": 148, "no2": 31,  "co": 1.55, "so2": 45,  "o3": 68},
    "Hyderabad": {"pm25": 52,  "pm10": 88,  "no2": 24,  "co": 1.05, "so2": 20,  "o3": 50},
    "Pune":      {"pm25": 48,  "pm10": 82,  "no2": 21,  "co": 0.98, "so2": 16,  "o3": 45},
    "Ahmedabad": {"pm25": 78,  "pm10": 125, "no2": 27,  "co": 1.35, "so2": 38,  "o3": 62},
    "Lucknow":   {"pm25": 112, "pm10": 178, "no2": 30,  "co": 1.65, "so2": 52,  "o3": 75},
    "Jaipur":    {"pm25": 88,  "pm10": 142, "no2": 26,  "co": 1.42, "so2": 42,  "o3": 65},
}

def calc_aqi(pm25, pm10, no2, co, so2, o3):
    def pm25_si(v):
        if v<=30: return v*50/30
        if v<=60: return 50+(v-30)*50/30
        if v<=90: return 100+(v-60)*100/30
        if v<=120: return 200+(v-90)*100/30
        if v<=250: return 300+(v-120)*100/130
        return min(400+(v-250)*100/130,500)
    def pm10_si(v):
        if v<=100: return v
        if v<=250: return 100+(v-100)*100/150
        if v<=350: return 200+(v-250)
        return min(300+(v-350)*100/80,500)
    return round(max(pm25_si(pm25), pm10_si(pm10), no2*50/80, co*50/2, so2*50/80, o3/2), 1)

def risk(aqi):
    if aqi < 100: return "Low", 0
    elif aqi <= 200: return "Moderate", 1
    else: return "High", 2

created_cities = []
for cd in cities_data:
    city = City(**cd)
    db.add(city)
    db.flush()
    created_cities.append(city)

db.commit()
print(f"Created {len(created_cities)} cities")

# Add AQI records for each city
for city in created_cities:
    profile = aqi_profiles.get(city.city_name, aqi_profiles["Mumbai"])
    
    # Add slight random variation
    pm25 = profile["pm25"] * random.uniform(0.9, 1.1)
    pm10 = profile["pm10"] * random.uniform(0.9, 1.1)
    no2  = profile["no2"]  * random.uniform(0.9, 1.1)
    co   = profile["co"]   * random.uniform(0.9, 1.1)
    so2  = profile["so2"]  * random.uniform(0.9, 1.1)
    o3   = profile["o3"]   * random.uniform(0.9, 1.1)
    aqi_score = calc_aqi(pm25, pm10, no2, co, so2, o3)
    
    record = AirQualityData(
        city_id=city.city_id,
        pm25=round(pm25,2), pm10=round(pm10,2),
        no2=round(no2,2),   co=round(co,3),
        so2=round(so2,2),   o3=round(o3,2),
        aqi_score=aqi_score
    )
    db.add(record)
    db.flush()
    
    risk_level, risk_label = risk(aqi_score)
    pred = MLPrediction(
        record_id=record.record_id,
        predicted_aqi=aqi_score,
        risk_level=risk_level,
        model_version="CPCB_Formula_v1"
    )
    db.add(pred)
    
    mit = MitigationStrategy(
        record_id=record.record_id,
        action_id=0 if risk_level=="Low" else (1 if risk_level=="Moderate" else 2),
        strategy_name="Issue Health Advisory" if risk_level=="High" else "Green Zone Advisory",
        description="Recommended based on current AQI levels",
        rl_reward=1.0
    )
    db.add(mit)

db.commit()
print("Seed data inserted successfully!")
print("\nCity AQI Summary:")
for city in created_cities:
    profile = aqi_profiles.get(city.city_name, aqi_profiles["Mumbai"])
    aqi = calc_aqi(profile["pm25"],profile["pm10"],profile["no2"],profile["co"],profile["so2"],profile["o3"])
    r, _ = risk(aqi)
    print(f"  {city.city_name}: AQI={aqi} ({r})")

db.close()
