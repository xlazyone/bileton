"""
WBS 4.3 | Role: [Lead Dev / Backend]
Схемы для афиши и сеансов (согласно контракту фронтенда).
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class MovieRead(BaseModel):
    id: uuid.UUID
    title: str
    poster_url: str | None
    genres: list[str]
    duration_minutes: int
    age_rating: str
    model_config = ConfigDict(from_attributes=True)

class HallRead(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class SessionRead(BaseModel):
    id: uuid.UUID
    movie_id: uuid.UUID
    starts_at: datetime
    hall: HallRead
    price: int
    model_config = ConfigDict(from_attributes=True)