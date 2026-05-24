import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.live_aqi import fetch_live_aqi, CITY_COORDS
from database import SessionLocal
from models import City, AirQualityData, AQIHistory
from ml.predict import predict_aqi_risk
import httpx

KEY = "255ff4877771d3eba23707c7fd9431e3"

async def refresh_all_cities():
    print("Auto-refreshing live AQI data...")
    db = SessionLocal()
    for name, (lat,lon) in CITY_COORDS.items():
        try:
            url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={KEY}"
            async with httpx.AsyncClient() as client:
                r = await client.get(url, timeout=10)
                c = r.json()["list"][0]["components"]
            city = db.query(City).filter(City.city_name==name).first()
            if not city: continue
            rec = db.query(AirQualityData).filter(AirQualityData.city_id==city.city_id).first()
            if rec:
                rec.pm25 = round(c["pm2_5"],2)
                rec.pm10 = round(c["pm10"],2)
                rec.no2  = round(c["no2"],2)
                rec.co   = round(c["co"]/1000,3)
                rec.so2  = round(c["so2"],2)
                rec.o3   = round(c["o3"],2)
                p = predict_aqi_risk(rec.pm25,rec.pm10,rec.no2,rec.co,rec.so2,rec.o3)
                rec.aqi_score = p["predicted_aqi"]
                
                # New: Add to AQIHistory
                hist = AQIHistory(
                    city_id=city.city_id,
                    city_name=city.city_name,
                    pm25=rec.pm25,
                    pm10=rec.pm10,
                    aqi_score=rec.aqi_score,
                    risk_level=p["risk_level"]
                )
                db.add(hist)
        except Exception as e:
            print(f"Error refreshing {name}: {e}")
    db.commit()
    db.close()
    print("Refresh complete")

def start_scheduler():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(refresh_all_cities, "interval", minutes=30)
    scheduler.start()
    return scheduler