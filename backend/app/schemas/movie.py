"""
WBS 4.2.2 | Role: [Lead Dev / Backend]
Схемы для афиши и сеансов.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class MovieRead(BaseModel):
    id: uuid.UUID
    title: str
    poster_url: str | None
    genres: list[str]
    duration_min: int
    age_rating: str

    model_config = ConfigDict(from_attributes=True)

class SessionRead(BaseModel):
    id: uuid.UUID
    movie_id: uuid.UUID
    hall_id: int
    start_time: datetime
    price: int

    model_config = ConfigDict(from_attributes=True)