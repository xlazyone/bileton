"""
WBS 5.3 | Role: [Lead Dev / Backend]
Роуты для бронирования мест.
"""
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingRead
from app.services import booking as booking_service

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("", response_model=BookingRead, status_code=201)
def create_new_booking(
    payload: BookingCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    """US-05: Бронирование места с защитой от двойных продаж (SELECT FOR UPDATE)."""
    return booking_service.create_booking(
        db=db,
        user=current_user,
        session_id=payload.session_id,
        seat_id=payload.seat_id
    )