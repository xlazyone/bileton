"""Маршруты авторизации.

Реализация — задача [Lead Dev] в рамках пакета 3.2.2 (см. use-cases.md, UC-01..UC-04).
Пока оставлены заглушки, чтобы приложение собиралось и CI был зелёным.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _not_implemented() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Эндпоинт будет реализован в пакете 3.2.2 ([Lead Dev])",
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate) -> UserRead:
    """UC-01: регистрация, роль viewer по умолчанию, 409 при занятом email."""
    raise _not_implemented()


@router.post("/login")
def login(payload: dict[str, str]) -> dict[str, str]:
    """UC-02: вход по email и паролю, выдача JWT."""
    raise _not_implemented()


@router.get("/me", response_model=UserRead)
def read_current_user() -> UserRead:
    """UC-04: текущий пользователь по JWT."""
    raise _not_implemented()
