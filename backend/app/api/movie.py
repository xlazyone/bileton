"""
WBS 4.2.2 | Role: [Lead Dev / Backend]
Роуты для афиши и сеансов.
"""
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.movie import MovieRead, SessionRead
from app.services import movie as movie_service

router = APIRouter(tags=["Afisha"])

@router.get("/movies", response_model=list[MovieRead])
def get_movies(db: Annotated[Session, Depends(get_db)]):
    """US-01: Получение списка фильмов."""
    return movie_service.get_all_movies(db)

@router.get("/movies/{movie_id}/sessions", response_model=list[SessionRead])
def get_movie_sessions(
    movie_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)]
):
    """US-02, US-03: Получение расписания выбранного фильма."""
    return movie_service.get_sessions_by_movie(db, movie_id)