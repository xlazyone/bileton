"""
WBS 5.2 | Role: [PM / Backend]
Модель места в зале.
"""
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.hall import Hall


class Seat(Base):
    """Физическое место в зале. Не зависит от сеанса.

    Занятость места на конкретном сеансе определяется таблицей bookings
    (см. docs/requirements/seat-reservation-logic.md, раздел 3).
    """

    __tablename__ = "seats"
    __table_args__ = (
        UniqueConstraint("hall_id", "row_number", "seat_number", name="uq_seats_hall_coords"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hall_id: Mapped[int] = mapped_column(
        ForeignKey("halls.id", ondelete="CASCADE"), nullable=False, index=True
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)

    hall: Mapped["Hall"] = relationship(back_populates="seats")
