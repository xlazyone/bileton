from datetime import UTC, datetime

from app.models.hall import Hall
from app.models.movie import Movie
from app.models.session import Session


def make_movie(**overrides) -> Movie:
    data = {
        "title": "Интерстеллар",
        "genres": ["фантастика", "драма"],
        "duration_minutes": 169,
        "age_rating": "12+",
        "poster_url": "/posters/interstellar.jpg",
    }
    data.update(overrides)
    return Movie(**data)


def test_movies_table_has_required_columns() -> None:
    columns = set(Movie.__table__.columns.keys())
    assert {
        "id",
        "title",
        "poster_url",
        "genres",
        "duration_minutes",
        "age_rating",
        "is_active",
        "created_at",
    } <= columns


def test_halls_table_has_required_columns() -> None:
    columns = set(Hall.__table__.columns.keys())
    assert {"id", "name"} <= columns


def test_sessions_table_has_required_columns() -> None:
    columns = set(Session.__table__.columns.keys())
    assert {
        "id",
        "movie_id",
        "hall_id",
        "starts_at",
        "price",
    } <= columns


def test_movies_have_defaults(session_factory) -> None:
    with session_factory() as db:
        movie = Movie(
            title="Интерстеллар",
            duration_minutes=169,
            age_rating="12+",
            poster_url="/posters/interstellar.jpg",
        )
        db.add(movie)
        db.commit()

        assert movie.is_active is True
        assert movie.genres == []


def test_session_links_movie_and_hall(session_factory) -> None:
    with session_factory() as db:
        movie = make_movie()
        hall = Hall(name="Зал 1")
        screening = Session(
            movie=movie,
            hall=hall,
            starts_at=datetime(2026, 11, 10, 18, 30, tzinfo=UTC),
            price=450,
        )
        db.add(screening)
        db.commit()

        assert screening.movie_id == movie.id
        assert screening.hall_id == hall.id
        assert screening.movie == movie
        assert screening.hall == hall
