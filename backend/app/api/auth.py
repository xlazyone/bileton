"""
WBS 3.2.2 | Role: [Lead Dev / Backend]
Маршруты авторизации.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserRead
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED
)
def register(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)]
):
    """UC-01: регистрация, роль viewer по умолчанию, 409 при занятом email."""
    try:
        return auth_service.register_user(db, payload)
    except ValueError as e:
        # B904: добавлено from e
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        ) from e


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)]
):
    """UC-02: вход по email и паролю, выдача JWT."""
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    if not user:
        # E501: строка разбита, чтобы не превышать 100 символов
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль"
        )

    token = create_access_token(str(user.id), user.role.value)
    return TokenResponse(access_token=token, role=user.role)


@router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)]
):
    """UC-04: текущий пользователь по JWT."""
    return current_user