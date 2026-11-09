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
from app.models.hall import Hall


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    movie_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("movies.id"), nullable=False)
    hall_id: Mapped[int] = mapped_column(ForeignKey("halls.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)

    movie = relationship("Movie")
    # lazy="joined" нужен, чтобы зал подтягивался одним запросом (решает N+1)
    hall = relationship("Hall", lazy="joined")
