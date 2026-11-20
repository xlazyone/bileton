"""WBS 5.4 — GET /api/sessions/{id}/seats: схема зала и занятость мест."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.models.hall import Hall
from app.models.movie import Movie
from app.models.seat import Seat
from app.models.session import Session as MovieSession
from app.models.user import User


def seed_hall_session(db: Session, rows: int = 3, per_row: int = 4) -> tuple[MovieSession, dict]:
    movie = Movie(title="Код доступа", genres=["триллер"], duration_minutes=114, age_rating="16+")
    hall = Hall(name="Зал 2", rows_count=rows, seats_per_row=per_row)
    db.add_all([movie, hall])
    db.flush()
    seats = {
        (row, number): Seat(hall_id=hall.id, row_number=row, seat_number=number)
        for row in range(1, rows + 1)
        for number in range(1, per_row + 1)
    }
    db.add_all(seats.values())
    movie_session = MovieSession(
        movie=movie, hall=hall, starts_at=datetime.now(UTC) + timedelta(days=1), price=450
    )
    db.add(movie_session)
    db.commit()
    return movie_session, seats


def add_user(db: Session, email: str) -> User:
    user = User(email=email, password_hash="x", full_name="QA")
    db.add(user)
    db.commit()
    return user


def book(db: Session, movie_session, seat, user, status, expires_in_minutes: int | None = 15):
    expires_at = (
        None
        if expires_in_minutes is None
        else datetime.now(UTC) + timedelta(minutes=expires_in_minutes)
    )
    db.add(
        Booking(
            session_id=movie_session.id,
            seat_id=seat.id,
            user_id=user.id,
            status=status,
            expires_at=expires_at,
        )
    )
    db.commit()


def test_returns_session_movie_hall_and_all_seats(client: TestClient, db: Session) -> None:
    movie_session, seats = seed_hall_session(db)

    response = client.get(f"/api/sessions/{movie_session.id}/seats")

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == str(movie_session.id)
    assert body["price"] == 450
    assert body["movie"]["title"] == "Код доступа"
    assert body["hall"] == {
        "id": movie_session.hall_id,
        "name": "Зал 2",
        "rows_count": 3,
        "seats_per_row": 4,
    }
    assert len(body["seats"]) == 12
    assert body["seats"][0] == {"id": seats[(1, 1)].id, "row": 1, "number": 1, "status": "free"}
    # Порядок: по рядам, внутри ряда — по номеру
    coords = [(seat["row"], seat["number"]) for seat in body["seats"]]
    assert coords == sorted(coords)


def test_public_endpoint_without_token(client: TestClient, db: Session) -> None:
    movie_session, _ = seed_hall_session(db)
    assert client.get(f"/api/sessions/{movie_session.id}/seats").status_code == 200


def test_occupancy_by_booking_status(client: TestClient, db: Session) -> None:
    movie_session, seats = seed_hall_session(db)
    user = add_user(db, "owner@test.ru")
    book(db, movie_session, seats[(1, 1)], user, BookingStatus.RESERVED, 15)  # активная бронь
    book(db, movie_session, seats[(1, 2)], user, BookingStatus.PAID, None)  # оплачено
    book(db, movie_session, seats[(1, 3)], user, BookingStatus.RESERVED, -1)  # просрочена
    book(db, movie_session, seats[(1, 4)], user, BookingStatus.CANCELLED, None)  # отменена

    statuses = {
        seat["number"]: seat["status"]
        for seat in client.get(f"/api/sessions/{movie_session.id}/seats").json()["seats"]
        if seat["row"] == 1
    }

    assert statuses == {1: "occupied", 2: "occupied", 3: "free", 4: "free"}


def test_booking_on_other_session_does_not_occupy_seat(client: TestClient, db: Session) -> None:
    movie_session, seats = seed_hall_session(db)
    other = MovieSession(
        movie_id=movie_session.movie_id,
        hall_id=movie_session.hall_id,
        starts_at=datetime.now(UTC) + timedelta(days=2),
        price=450,
    )
    db.add(other)
    db.commit()
    book(db, other, seats[(2, 2)], add_user(db, "other@test.ru"), BookingStatus.RESERVED)

    body = client.get(f"/api/sessions/{movie_session.id}/seats").json()

    assert {seat["status"] for seat in body["seats"]} == {"free"}


def test_unknown_session_returns_404(client: TestClient) -> None:
    response = client.get(f"/api/sessions/{uuid.uuid4()}/seats")

    assert response.status_code == 404
    assert response.json() == {"detail": "Сеанс не найден"}


def test_invalid_session_id_returns_422(client: TestClient) -> None:
    assert client.get("/api/sessions/not-a-uuid/seats").status_code == 422
