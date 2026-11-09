"""
WBS 4.2.1 | Role: [PM / Backend]
Модель фильма.
"""
import uuid
from sqlalchemy import String, Integer, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    poster_url: Mapped[str] = mapped_column(Text, nullable=True)
    genres: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    age_rating: Mapped[str] = mapped_column(String(10), nullable=False) # например, "16+"