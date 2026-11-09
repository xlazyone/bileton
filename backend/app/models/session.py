"""
WBS 4.2.1 | Role: [PM / Backend]
Модель сеанса.
"""
import uuid
from datetime import datetime
from sqlalchemy import Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.movie import Movie

class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    movie_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("movies.id"), nullable=False)
    hall_id: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False) # цена в копейках или рублях

    movie = relationship("Movie")