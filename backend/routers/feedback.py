from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid

from database import get_db
from models import Feedback, User
from schemas import FeedbackCreate, FeedbackResponse
from routers.auth import verify_firebase_token, get_or_create_user

router = APIRouter()


class StatusUpdate(BaseModel):
    status: str  # open | in_review | resolved | rejected

def check_admin_role(token_data: dict, db: Session) -> User:
    """Helper function to check if user has admin role"""
    firebase_uid = token_data.get('uid')
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

@router.post("/submit", response_model=FeedbackResponse)
async def submit_feedback(
    feedback_data: FeedbackCreate,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Submit new feedback"""
    
    user = get_or_create_user(token_data, db)
    
    # Create new feedback
    new_feedback = Feedback(
        user_id=user.user_id,
        subject=feedback_data.subject,
        message=feedback_data.message,
        status='open'
    )
    
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    
    return FeedbackResponse(
        feedback_id=new_feedback.feedback_id,
        subject=new_feedback.subject,
        status=new_feedback.status,
        created_at=new_feedback.created_at
    )

@router.get("/my", response_model=List[FeedbackResponse])
async def get_my_feedback(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all feedback submitted by current user"""
    
    user = get_or_create_user(token_data, db)
    
    # Get user's feedback
    feedback_list = db.query(Feedback)\
        .filter(Feedback.user_id == user.user_id)\
        .order_by(Feedback.created_at.desc())\
        .all()
    
    result = []
    for feedback in feedback_list:
        result.append(FeedbackResponse(
            feedback_id=feedback.feedback_id,
            subject=feedback.subject,
            status=feedback.status,
            created_at=feedback.created_at
        ))
    
    return result

@router.get("/all")
async def get_all_feedback(
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Get all feedback with submitter details (admin only)"""

    check_admin_role(token_data, db)

    rows = (
        db.query(Feedback, User)
        .outerjoin(User, Feedback.user_id == User.user_id)
        .order_by(Feedback.created_at.desc())
        .all()
    )

    return [
        {
            "id":         str(fb.feedback_id),
            "subject":    fb.subject,
            "message":    fb.message,
            "status":     fb.status,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
            "user_email": user.email if user else "unknown",
            "user_name":  user.name  if user else "Unknown User",
        }
        for fb, user in rows
    ]

@router.patch("/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: str,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Mark feedback as resolved (admin only) — legacy endpoint kept for compatibility"""
    return await update_feedback_status(feedback_id, StatusUpdate(status="resolved"), token_data, db)


@router.patch("/{feedback_id}/status")
async def update_feedback_status(
    feedback_id: str,
    body: StatusUpdate,
    token_data: dict = Depends(verify_firebase_token),
    db: Session = Depends(get_db)
):
    """Update feedback status to any valid value (admin only)"""

    allowed = {"open", "in_review", "resolved", "rejected"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {allowed}")

    check_admin_role(token_data, db)

    try:
        feedback_uuid = uuid.UUID(feedback_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid feedback ID format")

    feedback = db.query(Feedback).filter(Feedback.feedback_id == feedback_uuid).first()
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")

    feedback.status = body.status
    db.commit()

    return {"message": f"Status updated to '{body.status}'", "feedback_id": feedback_id}