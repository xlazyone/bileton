"""
WBS 5.3 | Role: [Lead Dev / Backend]
Логика бронирования с защитой от race condition (SELECT FOR UPDATE).
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.booking import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus
from app.models.seat import Seat
from app.models.session import Session as MovieSession
from app.models.user import User

# TTL мягкой брони (15 минут) из требований аналитика (WBS 5.1)
BOOKING_TTL_MINUTES = 15


def create_booking(db: Session, user: User, session_id: uuid.UUID, seat_id: int) -> Booking:
    try:
        # БАГ 2: Проверяем, существует ли сеанс (чтобы не было 500 из-за FK)
        movie_session = db.query(MovieSession).filter(MovieSession.id == session_id).first()
        if not movie_session:
            raise HTTPException(status_code=404, detail="Сеанс не найден")

        # 1. Блокируем место (SELECT FOR UPDATE)
        # Это гарантирует, что пока мы не закончим транзакцию, никто другой не сможет
        # прочитать или изменить это место (очередь запросов выстроится).
        seat = db.query(Seat).filter(Seat.id == seat_id).with_for_update().first()

        if not seat:
            raise HTTPException(status_code=404, detail="Место не найдено")

        # БАГ 3: Проверяем, что место принадлежит залу этого сеанса
        if seat.hall_id != movie_session.hall_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Это место находится в другом зале"
            )

        # 2. Проверяем, нет ли уже активной брони на это место
        existing_booking = db.query(Booking).filter(
            Booking.session_id == session_id,
            Booking.seat_id == seat_id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES)
        ).first()

        now = datetime.now(timezone.utc)

        if existing_booking:
            # БАГ 1: Если бронь просрочена, освобождаем место
            if existing_booking.status == BookingStatus.RESERVED and existing_booking.expires_at and existing_booking.expires_at < now:
                existing_booking.status = BookingStatus.CANCELLED
                db.flush()  # Сбрасываем статус в БД, чтобы освободить место для новой брони

            # Сценарий B (Двойной клик): Если бронь принадлежит этому же юзеру
            elif existing_booking.user_id == user.id and existing_booking.status == BookingStatus.RESERVED:
                return existing_booking  # Идемпотентный возврат

            # Сценарий A (Конфликт): Место занято кем-то другим
            else:
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
        expires_at = now + timedelta(minutes=BOOKING_TTL_MINUTES)

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
        # Если упала наша же ошибка (404, 400, 409), откатываем транзакцию и пробрасываем дальше
        db.rollback()
        raise
    except Exception as e:
        # Если упала база (например, UniqueConstraint), откатываем
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании брони"
        ) from e