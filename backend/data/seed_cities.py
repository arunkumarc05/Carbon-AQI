import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import City

def seed_cities():
    print("🏙️  Starting to seed Indian cities...")
    
    # Create database session
    db = SessionLocal()
    
    try:
        # List of Indian cities with their data
        cities_data = [
            {
                "city_name": "Delhi",
                "country": "India",
                "latitude": 28.6139,
                "longitude": 77.2090,
                "population": 31181376
            },
            {
                "city_name": "Mumbai",
                "country": "India",
                "latitude": 19.0760,
                "longitude": 72.8777,
                "population": 20667656
            },
            {
                "city_name": "Chennai",
                "country": "India",
                "latitude": 13.0827,
                "longitude": 80.2707,
                "population": 10971108
            },
            {
                "city_name": "Bangalore",
                "country": "India",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "population": 12765000
            },
            {
                "city_name": "Hyderabad",
                "country": "India",
                "latitude": 17.3850,
                "longitude": 78.4867,
                "population": 10268653
            },
            {
                "city_name": "Kolkata",
                "country": "India",
                "latitude": 22.5726,
                "longitude": 88.3639,
                "population": 14850000
            },
            {
                "city_name": "Pune",
                "country": "India",
                "latitude": 18.5204,
                "longitude": 73.8567,
                "population": 6987077
            },
            {
                "city_name": "Ahmedabad",
                "country": "India",
                "latitude": 23.0225,
                "longitude": 72.5714,
                "population": 8059441
            },
            {
                "city_name": "Visakhapatnam",
                "country": "India",
                "latitude": 17.6868,
                "longitude": 83.2185,
                "population": 2035922
            },
            {
                "city_name": "Lucknow",
                "country": "India",
                "latitude": 26.8467,
                "longitude": 80.9462,
                "population": 3382900
            }
        ]
        
        # Insert each city
        for city_data in cities_data:
            # Check if city already exists
            existing_city = db.query(City).filter(
                City.city_name == city_data["city_name"],
                City.country == city_data["country"]
            ).first()
            
            if existing_city:
                print(f"⚠️  {city_data['city_name']} already exists in database")
                continue
            
            # Create new city
            city = City(**city_data)
            db.add(city)
            db.commit()
            db.refresh(city)
            
            print(f"✅ Successfully inserted {city.city_name} (ID: {city.city_id})")
        
        print(f"\n🎉 City seeding completed! Total cities in database: {len(db.query(City).all())}")
        
    except Exception as e:
        print(f"❌ Error seeding cities: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_cities()
