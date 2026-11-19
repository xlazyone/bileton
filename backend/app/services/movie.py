"""
WBS 4.3 | Role: [Lead Dev / Backend]
Бизнес-логика получения афиши и сеансов.
"""
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.movie import Movie
from app.models.session import Session as MovieSession


def get_all_movies(db: Session) -> list[Movie]:
    # US-01: Показываем только активные фильмы
    return db.query(Movie).filter(Movie.is_active.is_(True)).all()


def get_sessions_by_movie(db: Session, movie_id: uuid.UUID) -> list[MovieSession]:
    now = datetime.now(UTC)

    # US-02/US-03: сортировка и скрытие прошедших
    return (
        db.query(MovieSession)
        .filter(MovieSession.movie_id == movie_id)
        .filter(MovieSession.starts_at > now)
        .order_by(MovieSession.starts_at.asc())
        .all()
    )