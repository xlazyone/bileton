from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.movie import Movie
from app.models.session import Session


def make_movie(**overrides) -> Movie:
    data = {
        "title": "Интерстеллар",
        "description": "Научно-фантастическая драма",
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
        "description",
        "genres",
        "duration_minutes",
        "age_rating",
        "poster_url",
        "is_active",
        "created_at",
        "updated_at",
    } <= columns


def test_sessions_table_has_required_columns() -> None:
    columns = set(Session.__table__.columns.keys())
    assert {
        "id",
        "movie_id",
        "starts_at",
        "hall",
        "price",
        "created_at",
        "updated_at",
    } <= columns


def test_movies_have_defaults_and_indexes(session_factory) -> None:
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

    movie_indexes = {index.name for index in Movie.__table__.indexes}
    session_indexes = {index.name for index in Session.__table__.indexes}
    assert "ix_movies_title" in movie_indexes
    assert "ix_sessions_movie_id_starts_at" in session_indexes
    assert "ix_sessions_starts_at" in session_indexes


def test_session_belongs_to_movie_and_is_deleted_with_it(session_factory) -> None:
    db = session_factory()
    try:
        movie = make_movie()
        screening = Session(
            movie=movie,
            starts_at=datetime(2026, 11, 10, 18, 30, tzinfo=UTC),
            hall="Зал 1",
            price=Decimal("450.00"),
        )
        db.add(movie)
        db.commit()

        assert movie.is_active is True
        assert screening.movie_id == movie.id
        assert movie.sessions == [screening]

        movie_id = movie.id
        screening_id = screening.id
        db.delete(movie)
        db.commit()

        assert db.get(Session, screening_id) is None
        assert db.get(Movie, movie_id) is None
    finally:
        db.close()


def test_movie_duration_must_be_positive(session_factory) -> None:
    db = session_factory()
    try:
        db.add(make_movie(duration_minutes=0))
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()


def test_session_price_cannot_be_negative(session_factory) -> None:
    db = session_factory()
    try:
        movie = make_movie()
        db.add(movie)
        db.flush()
        db.add(
            Session(
                movie_id=movie.id,
                starts_at=datetime(2026, 11, 10, 18, 30, tzinfo=UTC),
                hall="Зал 1",
                price=Decimal("-1.00"),
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
    finally:
        db.rollback()
        db.close()
