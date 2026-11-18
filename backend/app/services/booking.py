"""
WBS 5.3 | Role: [Lead Dev / Backend]
Логика бронирования с защитой от race condition (SELECT FOR UPDATE).
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.seat import Seat
from app.models.user import User

# TTL мягкой брони (15 минут) из требований аналитика (WBS 5.1)
BOOKING_TTL_MINUTES = 15


def create_booking(db: Session, user: User, session_id: uuid.UUID, seat_id: int) -> Booking:
    try:
        # 1. Блокируем место (SELECT FOR UPDATE)
        # Это гарантирует, что пока мы не закончим транзакцию, никто другой не сможет
        # прочитать или изменить это место (очередь запросов выстроится).
        seat = db.query(Seat).filter(Seat.id == seat_id).with_for_update().first()

        if not seat:
            raise HTTPException(status_code=404, detail="Место не найдено")

        # 2. Проверяем, нет ли уже активной брони на это место
        existing_booking = db.query(Booking).filter(
            Booking.session_id == session_id,
            Booking.seat_id == seat_id,
            Booking.status.in_([BookingStatus.RESERVED, BookingStatus.PAID])
        ).first()

        if existing_booking:
            # Сценарий B (Двойной клик): Если бронь принадлежит этому же юзеру, отдаем её
            if existing_booking.user_id == user.id and existing_booking.status == BookingStatus.RESERVED:
                # Проверяем, не истек ли таймаут (на случай фоновой очистки)
                if existing_booking.expires_at and existing_booking.expires_at > datetime.now(timezone.utc):
                    return existing_booking  # Идемпотентный возврат (200/201)

            # Сценарий A (Конфликт): Место занято кем-то другим или таймаут истек
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "SEAT_ALREADY_BOOKED",
                    "message": "Это место уже забронировано",
                    "session_id": str(session_id),
                    "seat_id": seat_id
                }
            )

        # 3. Создаем новую бронь (Сценарий C)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=BOOKING_TTL_MINUTES)

        new_booking = Booking(
            user_id=user.id,
            session_id=session_id,
            seat_id=seat_id,
            status=BookingStatus.RESERVED,
            expires_at=expires_at
        )

        db.add(new_booking)
        db.commit()
        db.refresh(new_booking)
        return new_booking

    except HTTPException:
        # Если упала наша же ошибка (404, 409), откатываем транзакцию и пробрасываем дальше
        db.rollback()
        raise
    except Exception as e:
        # Если упала база (например, UniqueConstraint), откатываем
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании брони"
        ) from e