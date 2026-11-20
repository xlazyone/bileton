"""
WBS 4.3, 5.4 | Role: [Lead Dev / Backend]
Роуты для афиши и сеансов.
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_optional
from app.db.session import get_db
from app.models.user import User
from app.schemas.movie import MovieRead, SessionRead, SessionSeatMap
from app.services import movie as movie_service

router = APIRouter(tags=["Afisha"])


@router.get("/movies", response_model=list[MovieRead])
def get_movies(db: Annotated[Session, Depends(get_db)]):
    """US-01: Получение списка фильмов."""
    return movie_service.get_all_movies(db)


@router.get("/sessions", response_model=list[SessionRead])
def get_sessions(
    movie_id: Annotated[uuid.UUID, Query(description="ID фильма для фильтрации")],
    db: Annotated[Session, Depends(get_db)]
):
    """US-02, US-03: Получение расписания сеансов."""
    return movie_service.get_sessions_by_movie(db, movie_id)


@router.get(
    "/sessions/{session_id}/seats",
    response_model=SessionSeatMap,
    response_model_exclude_none=True,  # expires_at приходит только у своих броней
)
def get_session_seats(
    session_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    viewer: Annotated[User | None, Depends(get_current_user_optional)],
):
    """WBS 5.4: схема зала сеанса — ряды, места и их занятость (free / occupied / mine).

    Эндпоинт публичный. С токеном брони самого пользователя приходят как mine + expires_at,
    чтобы после возврата на страницу он видел свои места.
    """
    seat_map = movie_service.get_session_seat_map(
        db, session_id, viewer_id=viewer.id if viewer else None
    )
    if seat_map is None:
        raise HTTPException(status_code=404, detail="Сеанс не найден")
    return seat_map