from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, Base
import uvicorn

# Import routers
from routers import auth, aqi, carbon, cities, ml_predict, rl_strategy, chatbot, feedback, translation, leaderboard, alerts

# Create FastAPI app
app = FastAPI(title="Carbon AQI API", version="1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(aqi.router, prefix="/api/aqi", tags=["aqi"])
app.include_router(carbon.router, prefix="/api/carbon", tags=["carbon"])
app.include_router(cities.router, prefix="/api/cities", tags=["cities"])
app.include_router(ml_predict.router, prefix="/api/predict", tags=["ml_predict"])
app.include_router(rl_strategy.router, prefix="/api/strategy", tags=["rl_strategy"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["chatbot"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["feedback"])
app.include_router(translation.router, prefix="/api/translation", tags=["translation"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])

# Startup event to create tables
@app.on_event("startup")
async def startup_event():
    # Create all database tables
    Base.metadata.create_all(bind=engine)

# Root endpoint
@app.get("/")
async def root():
    return {"status": "Carbon AQI API running"}

# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", reload=True, port=8000)