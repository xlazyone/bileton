"""
WBS 5.2 | Role: [PM / Backend]
Модель брони места на сеансе.

Статусы и ограничения — по docs/requirements/seat-reservation-logic.md (WBS 5.1):
* место на сеансе занято, пока бронь в статусе reserved (и expires_at в будущем) или paid;
* уникальность (session_id, seat_id) среди активных броней — страховка поверх
  SELECT ... FOR UPDATE из пакета 5.3;
* индекс по expires_at — для фоновой очистки просроченных броней.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BookingStatus(enum.StrEnum):
    """Статусы брони."""

    RESERVED = "reserved"  # забронировано, ожидает оплаты (TTL 15 минут)
    PAID = "paid"  # оплачено, билет оформлен
    USED = "used"  # билет использован (проход по QR)
    CANCELLED = "cancelled"  # бронь отменена пользователем/системой, место свободно


#: Статусы, при которых место считается занятым
ACTIVE_BOOKING_STATUSES: tuple[BookingStatus, ...] = (
    BookingStatus.RESERVED,
    BookingStatus.PAID,
)

_ACTIVE_STATUSES_SQL = "status IN ('reserved', 'paid')"


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        # Уникальность места на сеансе только среди активных броней:
        # отменённые записи остаются в истории и не мешают новой брони.
        Index(
            "uq_bookings_active_seat",
            "session_id",
            "seat_id",
            unique=True,
            postgresql_where=text(_ACTIVE_STATUSES_SQL),
            sqlite_where=text(_ACTIVE_STATUSES_SQL),
        ),
        Index("ix_bookings_expires_at", "expires_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # Сеанс с активной бронью удалить нельзя (RESTRICT), защищает историю броней
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="RESTRICT"), nullable=False
    )
    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            name="booking_status",
            values_callable=lambda items: [item.value for item in items],
        ),
        nullable=False,
        default=BookingStatus.RESERVED,
        server_default=BookingStatus.RESERVED.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    # created_at + TTL; NULL для paid / used / cancelled
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session = relationship("Session")
    seat = relationship("Seat")
    user = relationship("User")
