"""
WBS 4.2.1 | Role: [PM / Backend]
Модель фильма.
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Text, Boolean, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    poster_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # JSON работает и в PostgreSQL, и в SQLite (для тестов)
    genres: Mapped[list[str]] = mapped_column(JSON, default=list)

    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    age_rating: Mapped[str] = mapped_column(String(10), nullable=False)

    # Полезные поля от Ивана
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
