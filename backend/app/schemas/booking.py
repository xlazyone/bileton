"""
WBS 5.3 | Role: [Lead Dev / Backend]
Схемы для бронирования мест.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.booking import BookingStatus


class BookingCreate(BaseModel):
    session_id: uuid.UUID
    seat_id: int


class BookingRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    seat_id: int
    status: BookingStatus
    created_at: datetime
    expires_at: datetime | None

    model_config = ConfigDict(from_attributes=True)