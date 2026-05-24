import os
import time
import httpx
from dotenv import load_dotenv

# Load .env from backend root directory
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
API_KEY = ("255ff4877771d3eba23707c7fd9431e3")

_cache = {}
_cache_ttl = 1800  # 30 minutes

def _sanitize(val):
    return None if (val is None or val == 0) else val

CITY_COORDS = {
    "Delhi":     (28.6139, 77.2090),
    "Mumbai":    (19.0760, 72.8777),
    "Bangalore": (12.9716, 77.5946),
    "Chennai":   (13.0827, 80.2707),
    "Kolkata":   (22.5726, 88.3639),
    "Hyderabad": (17.3850, 78.4867),
    "Pune":      (18.5204, 73.8567),
    "Ahmedabad": (23.0225, 72.5714),
    "Lucknow":   (26.8467, 80.9462),
    "Jaipur":    (26.9124, 75.7873),
}

async def fetch_live_aqi(city_name: str) -> dict | None:
    coords = CITY_COORDS.get(city_name)
    if not coords or not API_KEY:
        return None
    lat, lon = coords

    cached = _cache.get(city_name)
    if cached and (time.time() - cached["ts"]) < _cache_ttl:
        return cached["data"]

    url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={lat}&lon={lon}&appid={API_KEY}"
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, timeout=10)
            if r.status_code != 200:
                return cached["data"] if cached else None
            data = r.json()
            comp = data["list"][0]["components"]
            result = {
                "pm25": _sanitize(round(comp.get("pm2_5", 0), 2)),
                "pm10": _sanitize(round(comp.get("pm10", 0), 2)),
                "no2":  _sanitize(round(comp.get("no2", 0), 2)),
                "co":   _sanitize(round(comp.get("co", 0) / 1000, 3)),
                "so2":  _sanitize(round(comp.get("so2", 0), 2)),
                "o3":   _sanitize(round(comp.get("o3", 0), 2)),
                "source": "live"
            }
            _cache[city_name] = {"data": result, "ts": time.time()}
            return result
    except Exception as e:
        print(f"Live AQI fetch error for {city_name}: {e}")
        return cached["data"] if cached else None

async def fetch_all_cities_live() -> list:
    results = []
    for city_name, (lat, lon) in CITY_COORDS.items():
        data = await fetch_live_aqi(city_name)
        if data:
            data["city"] = city_name
            results.append(data)
    return results