"""
WBS 4.3 | Role: [Lead Dev / Backend]
Роуты для афиши и сеансов.
"""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.movie import MovieRead, SessionRead
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