import sys
import os
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqlalchemy.sql import text
from database import SessionLocal

CITIES = {
    "Mumbai":    ("cf947175-8402-4272-8c95-d12939c09783", 97),
    "Delhi":     ("1356e5c8-0ff6-41e5-b931-a725025b9ce2", 90),
    "Bangalore": ("f0795c2f-543e-4acd-bac7-cd6b14bc9fd9", 135),
    "Chennai":   ("9e4d3e37-9200-4af2-840e-43b0cd2464f8", 46),
    "Kolkata":   ("315abc3a-f6e1-404d-95d4-af9ec19ff1af", 57),
    "Hyderabad": ("c6ced76d-be98-45fc-b8c4-39aa966074c3", 143),
    "Pune":      ("a2289116-165c-4993-bd26-75065f5b0390", 297),
    "Ahmedabad": ("b8650bd0-b36f-44d8-bbad-a8c2f358ddfd", 95),
    "Lucknow":   ("858c6584-d7d3-4289-801d-1bad929b1674", 182),
    "Jaipur":    ("81c48f45-99ce-4ee1-aba2-c3ef64a1b033", 145),
}

INSERT_SQL = text("""
    INSERT INTO aqi_history (city_id, city_name, aqi_score, recorded_at)
    VALUES (:city_id, :city_name, :aqi_score, :recorded_at)
""")

COUNT_SQL = text("SELECT COUNT(*) FROM aqi_history")


def seed():
    db = SessionLocal()
    try:
        existing = db.execute(COUNT_SQL).scalar()
        if existing > 100:
            print(f"Already seeded ({existing} rows found), skipping.")
            return

        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        total = 0

        for city_name, (city_id, base_aqi) in CITIES.items():
            rows = []
            for day in range(30, 0, -1):
                for hour_offset in [0, 6, 12, 18]:
                    ts = now - timedelta(days=day) + timedelta(hours=hour_offset)
                    variation = random.uniform(0.8, 1.2)
                    aqi_score = round(base_aqi * variation, 1)
                    rows.append({
                        "city_id":     city_id,
                        "city_name":   city_name,
                        "aqi_score":   aqi_score,
                        "recorded_at": ts,
                    })

            db.execute(INSERT_SQL, rows)
            db.commit()
            total += len(rows)
            print(f"Seeding {city_name}... done ({len(rows)} rows)")

        print(f"\nTotal rows inserted: {total}")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
