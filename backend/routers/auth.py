from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Dict
import os
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

from database import get_db
from models import User
from schemas import UserCreate, UserResponse

# Load environment variables
load_dotenv()

# Initialize Firebase Admin SDK
try:
    firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if firebase_credentials_path and not firebase_admin._apps:
        if os.path.exists(firebase_credentials_path):
            cred = credentials.Certificate(firebase_credentials_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully")
        else:
            print(f"Firebase credentials file not found at: {firebase_credentials_path}")
            print("Running in development mode without Firebase Admin SDK")
except Exception as e:
    print(f"Firebase initialization error: {e}")
    print("Running in development mode without Firebase Admin SDK")

router = APIRouter()

# Dependency to verify Firebase token
async def verify_firebase_token(authorization: str = Header(None)) -> Dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract Bearer token
        token = authorization.split("Bearer ")[1]
    except IndexError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    # Check if Firebase Admin SDK is initialized
    if not firebase_admin._apps:
        # Development mode: accept any token and create a mock user data
        print("Warning: Running in development mode without Firebase verification")
        return {
            'uid': 'dev_user_123',
            'email': 'dev@example.com',
            'name': 'Development User'
        }
    
    try:
        # Verify Firebase token
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def get_or_create_user(token_data: dict, db: Session) -> User:
    """
    Look up the DB user by firebase_uid.
    Auto-creates the record from the token if the user hasn't registered yet,
    so that any authenticated route works immediately after Firebase login.
    """
    firebase_uid = token_data.get('uid')
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        user = User(
            firebase_uid=firebase_uid,
            email=token_data.get('email', f'{firebase_uid}@unknown.com'),
            name=token_data.get('name', token_data.get('email', 'User')),
            password_hash='firebase_auth',
            preferred_language='en',
            role='user'
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.post("/register", response_model=UserResponse)
async def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with Firebase UID"""
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | 
        (User.firebase_uid == user_data.firebase_uid)
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create new user
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        password_hash=user_data.password,  # In production, this would be handled by Firebase
        firebase_uid=user_data.firebase_uid,
        preferred_language='en',
        role='user'
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    token_data: Dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    firebase_uid = token_data.get('uid')
    
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.put("/language")
async def update_language(
    language_data: dict,
    token_data: Dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Update user's preferred language"""
    firebase_uid = token_data.get('uid')
    language = language_data.get('language')
    
    if not language:
        raise HTTPException(status_code=400, detail="Language is required")
    
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.preferred_language = language
    db.commit()
    
    return {"message": "Language updated"}