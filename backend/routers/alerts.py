from fastapi import APIRouter, Query
from typing import Optional

from services.alert_engine import get_active_alerts_for_city, get_active_alerts_for_all_cities

router = APIRouter()


@router.get("/active")
async def get_active_alerts(city_id: Optional[str] = Query(None)):
    if city_id:
        return get_active_alerts_for_city(city_id)
    return get_active_alerts_for_all_cities()
