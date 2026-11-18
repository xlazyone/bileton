"""
WBS 5.2 | Role: [PM / Backend]
Модель кинозала.
"""
from typing import TYPE_CHECKING

from sqlalchemy import Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:  # pragma: no cover
    from app.models.seat import Seat


class Hall(Base):
    __tablename__ = "halls"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Параметры сетки зала: по ним строится схема мест (WBS 5.4)
    rows_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10, server_default=text("10")
    )
    seats_per_row: Mapped[int] = mapped_column(
        Integer, nullable=False, default=12, server_default=text("12")
    )

    seats: Mapped[list["Seat"]] = relationship(
        back_populates="hall",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Seat.row_number, Seat.seat_number",
    )
