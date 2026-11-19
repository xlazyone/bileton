"""
WBS 4.3, 5.4 | Role: [Lead Dev / Backend]
Бизнес-логика получения афиши и сеансов.
"""
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.booking import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus
from app.models.movie import Movie
from app.models.seat import Seat
from app.models.session import Session as MovieSession


def get_all_movies(db: Session) -> list[Movie]:
    return db.query(Movie).filter(Movie.is_active.is_(True)).all()


def get_sessions_by_movie(db: Session, movie_id: uuid.UUID) -> list[MovieSession]:
    now = datetime.now(UTC)
    return (
        db.query(MovieSession)
        .filter(MovieSession.movie_id == movie_id)
        .filter(MovieSession.starts_at > now)
        .order_by(MovieSession.starts_at.asc())
        .all()
    )

def _as_utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def _blocks_seat(status: BookingStatus, expires_at: datetime | None, now: datetime) -> bool:
    if status == BookingStatus.PAID:
        return True
    expires_at = _as_utc(expires_at)
    return expires_at is None or expires_at > now


def get_session_seat_map(db: Session, session_id: uuid.UUID) -> dict | None:
    movie_session = db.get(MovieSession, session_id)
    if movie_session is None:
        return None

    hall = movie_session.hall
    seats = (
        db.query(Seat)
        .filter(Seat.hall_id == hall.id)
        .order_by(Seat.row_number, Seat.seat_number)
        .all()
    )

    now = datetime.now(UTC)
    active = (
        db.query(Booking.seat_id, Booking.status, Booking.expires_at)
        .filter(Booking.session_id == session_id)
        .filter(Booking.status.in_(ACTIVE_BOOKING_STATUSES))
        .all()
    )
    occupied = {
        seat_id for seat_id, status, expires_at in active if _blocks_seat(status, expires_at, now)
    }

    movie = movie_session.movie
    return {
        "session_id": movie_session.id,
        "starts_at": movie_session.starts_at,
        "price": movie_session.price,
        "movie": {"id": movie.id, "title": movie.title, "age_rating": movie.age_rating},
        "hall": {
            "id": hall.id,
            "name": hall.name,
            "rows_count": hall.rows_count,
            "seats_per_row": hall.seats_per_row,
        },
        "seats": [
            {
                "id": seat.id,
                "row": seat.row_number,
                "number": seat.seat_number,
                "status": "occupied" if seat.id in occupied else "free",
            }
            for seat in seats
        ],
    }