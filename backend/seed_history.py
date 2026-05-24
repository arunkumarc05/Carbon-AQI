import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal, engine
from models import City, AirQualityData, AQIHistory
from sqlalchemy.sql import text
import random
from datetime import datetime, timedelta

def seed_history():
    print("Seeding history data...")
    db = SessionLocal()
    try:
        cities = db.query(City).all()
        for city in cities:
            rec = db.query(AirQualityData).filter(AirQualityData.city_id == city.city_id).first()
            if rec:
                base_aqi = rec.aqi_score or 150
                for day in range(7):
                    dt = datetime.now() - timedelta(days=day)
                    variation = random.uniform(0.85, 1.15)
                    aqi = round(base_aqi * variation, 1)
                    pm25 = round((rec.pm25 or 50) * variation, 2)
                    pm10 = round((rec.pm10 or 80) * variation, 2)
                    risk = 'High' if aqi > 200 else 'Moderate' if aqi > 100 else 'Low'
                    
                    hist = AQIHistory(
                        city_id=city.city_id,
                        city_name=city.city_name,
                        aqi_score=aqi,
                        pm25=pm25,
                        pm10=pm10,
                        risk_level=risk,
                        recorded_at=dt
                    )
                    db.add(hist)
        db.commit()
        print("History data created successfully")
    except Exception as e:
        print(f"Error seeding history: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_history()
