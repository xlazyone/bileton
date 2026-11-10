from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.hall import Hall
from app.models.movie import Movie
from app.models.session import Session as MovieSession


def seed_catalog(db: Session) -> tuple[Movie, Movie, Hall]:
    active = Movie(
        title="Северное сияние",
        genres=["драма", "приключения"],
        duration_minutes=128,
        age_rating="12+",
        poster_url="/posters/northern-lights.jpg",
    )
    inactive = Movie(
        title="Снят с проката",
        genres=["комедия"],
        duration_minutes=90,
        age_rating="6+",
        poster_url=None,
        is_active=False,
    )
    hall = Hall(name="Зал 1")
    db.add_all([active, inactive, hall])
    db.commit()
    return active, inactive, hall


def test_get_movies_returns_only_active_movies(client: TestClient, db: Session) -> None:
    active, _, _ = seed_catalog(db)

    response = client.get("/api/movies")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(active.id)
    assert payload[0]["title"] == active.title
    assert payload[0]["genres"] == active.genres
    assert "is_active" not in payload[0]


def test_get_sessions_returns_future_sessions_with_hall(
    client: TestClient, db: Session
) -> None:
    movie, _, hall = seed_catalog(db)
    now = datetime.now(UTC)
    db.add_all(
        [
            MovieSession(
                movie=movie,
                hall=hall,
                starts_at=now + timedelta(days=1),
                price=450,
            ),
            MovieSession(
                movie=movie,
                hall=hall,
                starts_at=now - timedelta(days=1),
                price=400,
            ),
        ]
    )
    db.commit()

    response = client.get("/api/sessions", params={"movie_id": str(movie.id)})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["movie_id"] == str(movie.id)
    assert payload[0]["hall"] == {"id": hall.id, "name": hall.name}
    assert payload[0]["price"] == 450


def test_get_sessions_returns_empty_list_when_no_sessions(
    client: TestClient, db: Session
) -> None:
    movie, _, _ = seed_catalog(db)

    response = client.get("/api/sessions", params={"movie_id": str(movie.id)})

    assert response.status_code == 200
    assert response.json() == []


def test_get_sessions_requires_movie_id(client: TestClient) -> None:
    response = client.get("/api/sessions")

    assert response.status_code == 422
