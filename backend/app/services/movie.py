"""
WBS 4.2.2 | Role: [Lead Dev / Backend]
Бизнес-логика получения афиши и сеансов.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.movie import Movie
from app.models.session import Session as MovieSession


def get_all_movies(db: Session) -> list[Movie]:
    return db.query(Movie).all()


def get_sessions_by_movie(db: Session, movie_id: uuid.UUID) -> list[MovieSession]:
    now = datetime.now(timezone.utc)

    # Согласно Use Case US-03: сортировка по start_time и скрытие прошедших сеансов
    return (
        db.query(MovieSession)
        .filter(MovieSession.movie_id == movie_id)
        .filter(MovieSession.start_time > now)
        .order_by(MovieSession.start_time.asc())
        .all()
    )