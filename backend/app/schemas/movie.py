"""
WBS 4.3, 5.4 | Role: [Lead Dev / Backend]
Схемы для афиши и сеансов.
"""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class HallRead(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class MovieRead(BaseModel):
    id: uuid.UUID
    title: str
    poster_url: str | None
    genres: list[str]
    duration_minutes: int
    age_rating: str

    model_config = ConfigDict(from_attributes=True)


class SessionRead(BaseModel):
    id: uuid.UUID
    movie_id: uuid.UUID
    starts_at: datetime
    hall: HallRead
    price: float

    model_config = ConfigDict(from_attributes=True)


# --- WBS 5.4: схема зала для выбора мест -------------------------------------

class SeatMapHall(BaseModel):
    id: int
    name: str
    rows_count: int
    seats_per_row: int


class SeatMapMovie(BaseModel):
    id: uuid.UUID
    title: str
    age_rating: str


class SeatState(BaseModel):
    id: int
    row: int
    number: int
    # mine — активная бронь текущего пользователя (только при запросе с токеном)
    status: Literal["free", "occupied", "mine"]
    # Для mine: до какого момента действует бронь (None — оплачено)
    expires_at: datetime | None = None


class SessionSeatMap(BaseModel):
    """Ответ GET /sessions/{id}/seats."""
    session_id: uuid.UUID
    starts_at: datetime
    price: float
    movie: SeatMapMovie
    hall: SeatMapHall
    seats: list[SeatState]