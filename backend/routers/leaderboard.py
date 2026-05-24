from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, asc
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import City, AirQualityData, AQIHistory

router = APIRouter()


# ── Response schema ──────────────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    city_name: str
    city_id: str
    average_aqi: float
    risk_level: str
    badge: Optional[str] = None

    class Config:
        from_attributes = True


# ── Helper ───────────────────────────────────────────────────────────────────

def get_risk_level(aqi: float) -> str:
    """Map numeric AQI to WHO/EPA risk-level label."""
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[LeaderboardEntry])
async def get_leaderboard(db: Session = Depends(get_db)):
    """
    GET /api/leaderboard

    Returns up to 10 cities ranked by ascending average AQI.
    - Primary source : air_quality_data table
    - Fallback source: aqi_history table (when air_quality_data has no rows)
    - Rank 1 = cleanest city (lowest average AQI)
    - Only rank-1 city receives the "Cleanest City" badge
    """

    # ── Primary: air_quality_data ────────────────────────────────────────────
    avg_aqi_col = func.avg(AirQualityData.aqi_score).label("average_aqi")

    results = (
        db.query(City.city_id, City.city_name, avg_aqi_col)
        .join(AirQualityData, City.city_id == AirQualityData.city_id)
        .filter(AirQualityData.aqi_score.isnot(None))
        .group_by(City.city_id, City.city_name)
        .order_by(asc(avg_aqi_col))
        .limit(10)
        .all()
    )

    # ── Fallback: aqi_history ────────────────────────────────────────────────
    if not results:
        avg_aqi_col_hist = func.avg(AQIHistory.aqi_score).label("average_aqi")

        results = (
            db.query(City.city_id, City.city_name, avg_aqi_col_hist)
            .join(AQIHistory, City.city_id == AQIHistory.city_id)
            .filter(AQIHistory.aqi_score.isnot(None))
            .group_by(City.city_id, City.city_name)
            .order_by(asc(avg_aqi_col_hist))
            .limit(10)
            .all()
        )

    if not results:
        return []

    # ── Build response ───────────────────────────────────────────────────────
    leaderboard: List[LeaderboardEntry] = []
    for i, (city_id, city_name, avg_aqi) in enumerate(results):
        rank = i + 1
        avg_aqi_val = round(float(avg_aqi), 1)
        leaderboard.append(
            LeaderboardEntry(
                rank=rank,
                city_name=city_name,
                city_id=str(city_id),
                average_aqi=avg_aqi_val,
                risk_level=get_risk_level(avg_aqi_val),
                badge="Cleanest City" if rank == 1 else None,
            )
        )

    return leaderboard
