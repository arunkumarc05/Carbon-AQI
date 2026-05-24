from sqlalchemy import Column, String, Float, Integer, Text, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import text
from sqlalchemy.orm import relationship
from database import Base, engine

# 1. Users Table
class User(Base):
    __tablename__ = "users"
    
    user_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)  # Firebase password hash
    firebase_uid = Column(String(128), unique=True, nullable=True, index=True)  # Firebase UID (nullable for flexibility)
    preferred_language = Column(String(10), default='en')
    role = Column(String(20), default='user')
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    air_quality_records = relationship("AirQualityData", back_populates="user")
    carbon_footprints = relationship("CarbonFootprint", back_populates="user")
    chatbot_logs = relationship("ChatbotLog", back_populates="user")
    feedback = relationship("Feedback", back_populates="user")
    city_comparisons = relationship("CityComparison", back_populates="user")

# 2. Cities Table
class City(Base):
    __tablename__ = "cities"
    
    city_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    city_name = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    population = Column(Integer, nullable=True)
    
    # Relationships
    air_quality_records = relationship("AirQualityData", back_populates="city")
    comparisons_as_city1 = relationship("CityComparison", foreign_keys="CityComparison.city1_id", back_populates="city1")
    comparisons_as_city2 = relationship("CityComparison", foreign_keys="CityComparison.city2_id", back_populates="city2")

# 3. AirQualityData Table
class AirQualityData(Base):
    __tablename__ = "air_quality_data"
    
    record_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.city_id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    co2_ppm = Column(Float, nullable=True)
    co = Column(Float, nullable=True)
    no2 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)
    aqi_score = Column(Float, nullable=True)
    recorded_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    city = relationship("City", back_populates="air_quality_records")
    user = relationship("User", back_populates="air_quality_records")
    ml_predictions = relationship("MLPrediction", back_populates="air_quality_record")
    mitigation_strategies = relationship("MitigationStrategy", back_populates="air_quality_record")

# 4. CarbonFootprint Table
class CarbonFootprint(Base):
    __tablename__ = "carbon_footprint"
    
    footprint_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    transport_emission = Column(Float, nullable=False)
    energy_emission = Column(Float, nullable=False)
    diet_emission = Column(Float, nullable=False)
    total_emission = Column(Float, nullable=False)
    calculated_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    user = relationship("User", back_populates="carbon_footprints")

# 5. MLPredictions Table
class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    
    prediction_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    record_id = Column(UUID(as_uuid=True), ForeignKey("air_quality_data.record_id"), nullable=False)
    predicted_aqi = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    model_version = Column(String(50), nullable=True)
    predicted_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    air_quality_record = relationship("AirQualityData", back_populates="ml_predictions")

# 6. MitigationStrategies Table
class MitigationStrategy(Base):
    __tablename__ = "mitigation_strategies"
    
    strategy_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    record_id = Column(UUID(as_uuid=True), ForeignKey("air_quality_data.record_id"), nullable=True)
    strategy_name = Column(String(100), nullable=False)
    action_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    rl_reward = Column(Float, nullable=True)
    selected_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    air_quality_record = relationship("AirQualityData", back_populates="mitigation_strategies")

# 7. ChatbotLogs Table
class ChatbotLog(Base):
    __tablename__ = "chatbot_logs"
    
    log_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    user = relationship("User", back_populates="chatbot_logs")

# 8. Feedback Table
class Feedback(Base):
    __tablename__ = "feedback"
    
    feedback_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default='open')
    created_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    user = relationship("User", back_populates="feedback")

# 9. CityComparison Table
class CityComparison(Base):
    __tablename__ = "city_comparison"
    
    comparison_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    city1_id = Column(UUID(as_uuid=True), ForeignKey("cities.city_id"), nullable=False)
    city2_id = Column(UUID(as_uuid=True), ForeignKey("cities.city_id"), nullable=False)
    compared_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    user = relationship("User", back_populates="city_comparisons")
    city1 = relationship("City", foreign_keys=[city1_id], back_populates="comparisons_as_city1")
    city2 = relationship("City", foreign_keys=[city2_id], back_populates="comparisons_as_city2")

# 10. AQIHistory Table
class AQIHistory(Base):
    __tablename__ = "aqi_history"
    
    history_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.city_id"), nullable=False)
    city_name = Column(String(100), nullable=False)
    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    aqi_score = Column(Float, nullable=True)
    risk_level = Column(String(20), nullable=True)
    recorded_at = Column(TIMESTAMP, server_default=text("NOW()"))
    
    # Relationships
    city = relationship("City")

# 11. CityAlert Table — written by alert_engine, read by /api/alerts endpoints
class CityAlert(Base):
    __tablename__ = "city_alerts"

    alert_id      = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    city_id       = Column(UUID(as_uuid=True), ForeignKey("cities.city_id"), nullable=False, index=True)
    city_name     = Column(String(100), nullable=False)
    alert_type    = Column(String(20),  nullable=False)   # CRITICAL | WARNING | ADVISORY
    message       = Column(Text,        nullable=False)
    aqi_value     = Column(Float,       nullable=True)
    strategy_name = Column(String(100), nullable=True)
    forecast_peak = Column(Float,       nullable=True)
    triggered_at  = Column(TIMESTAMP,   server_default=text("NOW()"))
    is_active     = Column(Boolean,     default=True, nullable=False)

    # Relationships
    city = relationship("City")


# 12. AlertNotification Table — lightweight poll target for the frontend
class AlertNotification(Base):
    __tablename__ = "alert_notifications"

    notification_id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    alert_id        = Column(UUID(as_uuid=True), ForeignKey("city_alerts.alert_id"), nullable=False, index=True)
    city_name       = Column(String(100), nullable=False)
    alert_type      = Column(String(20),  nullable=False)
    message         = Column(Text,        nullable=False)
    created_at      = Column(TIMESTAMP,   server_default=text("NOW()"))
    is_read         = Column(Boolean,     default=False, nullable=False)


# Create all tables on startup
Base.metadata.create_all(bind=engine)