"""WBS 5.2: структура таблиц halls, seats, bookings.

Проверяются модель и ограничения из docs/requirements/seat-reservation-logic.md (раздел 7).
API бронирования — пакет 5.3, здесь его нет.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from app.models import Booking, BookingStatus, Hall, Movie, Seat, Session, User


def make_user(email: str = "viewer@example.com") -> User:
    return User(email=email, password_hash="hash")


def make_movie(title: str = "Интерстеллар") -> Movie:
    return Movie(
        title=title,
        genres=["фантастика"],
        duration_minutes=169,
        age_rating="12+",
    )


def make_hall(name: str = "Зал 1", rows: int = 2, per_row: int = 3) -> Hall:
    return Hall(name=name, rows_count=rows, seats_per_row=per_row)


def make_seat(hall: Hall, row: int = 1, number: int = 1) -> Seat:
    return Seat(hall=hall, row_number=row, seat_number=number)


def make_session(movie: Movie, hall: Hall) -> Session:
    return Session(
        movie=movie,
        hall=hall,
        starts_at=datetime.now(UTC) + timedelta(days=1),
        price=450,
    )


def make_booking(
    session: Session,
    seat: Seat,
    user: User,
    status: BookingStatus = BookingStatus.RESERVED,
    expires_in: timedelta | None = timedelta(minutes=15),
) -> Booking:
    return Booking(
        session=session,
        seat=seat,
        user=user,
        status=status,
        expires_at=None if expires_in is None else datetime.now(UTC) + expires_in,
    )


# --- структура таблиц -------------------------------------------------------


def test_halls_table_has_grid_columns() -> None:
    columns = set(Hall.__table__.columns.keys())
    assert {"id", "name", "rows_count", "seats_per_row"} <= columns


def test_seats_table_has_required_columns() -> None:
    columns = set(Seat.__table__.columns.keys())
    assert {"id", "hall_id", "row_number", "seat_number"} <= columns


def test_bookings_table_has_required_columns() -> None:
    columns = set(Booking.__table__.columns.keys())
    assert {
        "id",
        "session_id",
        "seat_id",
        "user_id",
        "status",
        "created_at",
        "expires_at",
    } <= columns


def test_booking_status_values() -> None:
    assert [status.value for status in BookingStatus] == [
        "reserved",
        "paid",
        "used",
        "cancelled",
    ]


def test_booking_status_defaults_to_reserved(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        user = make_user()
        screening = make_session(movie, hall)
        seat = make_seat(hall)
        booking = Booking(session=screening, seat=seat, user=user)
        db.add_all([hall, movie, user, booking])
        db.commit()

        assert booking.status is BookingStatus.RESERVED
        assert booking.created_at is not None
        assert booking.expires_at is None


# --- базовая связность ------------------------------------------------------


def test_booking_links_session_seat_and_user(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        user = make_user()
        seat = make_seat(hall)
        screening = make_session(movie, hall)
        booking = make_booking(screening, seat, user)
        db.add_all([hall, movie, user, booking])
        db.commit()

        db.expire_all()
        stored = db.get(Booking, booking.id)
        assert stored.session_id == screening.id
        assert stored.seat_id == seat.id
        assert stored.user_id == user.id
        assert stored.seat.hall_id == hall.id


# --- уникальность координат места ------------------------------------------


def test_seat_coordinates_are_unique_within_hall(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        db.add(hall)
        db.add_all([make_seat(hall, 1, 1), make_seat(hall, 1, 1)])
        with pytest.raises(IntegrityError):
            db.commit()


def test_same_coordinates_allowed_in_different_halls(session_factory) -> None:
    with session_factory() as db:
        first = make_hall("Зал 1")
        second = make_hall("Зал 2")
        db.add_all([first, second, make_seat(first, 1, 1), make_seat(second, 1, 1)])
        db.commit()

        assert db.get(Seat, 1).row_number == db.get(Seat, 2).row_number == 1


# --- уникальность активной брони на (session_id, seat_id) ------------------


def test_double_active_booking_for_same_seat_is_rejected(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        user = make_user()
        seat = make_seat(hall)
        screening = make_session(movie, hall)
        db.add_all(
            [
                hall,
                movie,
                user,
                make_booking(screening, seat, user),
                make_booking(screening, seat, user, status=BookingStatus.PAID, expires_in=None),
            ]
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_cancelled_booking_does_not_block_new_reservation(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        user = make_user()
        seat = make_seat(hall)
        screening = make_session(movie, hall)
        cancelled = make_booking(
            screening,
            seat,
            user,
            status=BookingStatus.CANCELLED,
            expires_in=None,
        )
        db.add_all([hall, movie, user, cancelled, make_booking(screening, seat, user)])
        db.commit()

        active = (
            db.query(Booking)
            .filter(Booking.status.in_([BookingStatus.RESERVED, BookingStatus.PAID]))
            .all()
        )
        assert len(active) == 1


def test_same_seat_on_different_sessions_is_allowed(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        user = make_user()
        seat = make_seat(hall)
        first = make_session(movie, hall)
        second = Session(
            movie=movie,
            hall=hall,
            starts_at=datetime.now(UTC) + timedelta(days=2),
            price=500,
        )
        db.add_all(
            [
                hall,
                movie,
                user,
                make_booking(first, seat, user),
                make_booking(second, seat, user),
            ]
        )
        db.commit()

        assert db.query(Booking).count() == 2


# --- ограничения целостности при удалении ----------------------------------


def test_session_with_booking_cannot_be_deleted(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        user = make_user()
        seat = make_seat(hall)
        screening = make_session(movie, hall)
        db.add_all([hall, movie, user, make_booking(screening, seat, user)])
        db.commit()

        db.delete(screening)
        with pytest.raises(IntegrityError):
            db.commit()


def test_deleting_hall_cascades_to_seats(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        db.add_all([hall, make_seat(hall, 1, 1), make_seat(hall, 1, 2)])
        db.commit()

        # Удаление через SQL: ORM-каскад здесь не участвует,
        # работает именно ON DELETE CASCADE из схемы БД.
        db.execute(Hall.__table__.delete().where(Hall.id == hall.id))
        db.commit()

        assert db.query(Seat).count() == 0


def test_booking_requires_existing_user(session_factory) -> None:
    with session_factory() as db:
        hall = make_hall()
        movie = make_movie()
        seat = make_seat(hall)
        screening = make_session(movie, hall)
        db.add_all([hall, movie])
        db.commit()

        # Бронь на пользователя, которого нет в users: FK не должен пропустить.
        # SQLite сообщает об этом при INSERT (OperationalError), на PostgreSQL это IntegrityError
        db.add(Booking(session=screening, seat=seat, user_id=uuid.uuid4()))
        with pytest.raises((IntegrityError, OperationalError)):
            db.commit()
