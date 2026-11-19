"""
WBS 4.3 | Role: [Lead Dev / Backend]
Схемы для афиши и сеансов.
"""
import uuid
from datetime import datetime

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
    # is_active сюда НЕ пишем, фронту он не нужен

    model_config = ConfigDict(from_attributes=True)


class SessionRead(BaseModel):
    id: uuid.UUID
    movie_id: uuid.UUID
    starts_at: datetime
    hall: HallRead  # Автоматически подтянет id и name из модели Hall
    price: float

    model_config = ConfigDict(from_attributes=True)