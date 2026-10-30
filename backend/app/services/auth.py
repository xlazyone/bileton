"""Бизнес-логика авторизации.

TODO [Lead Dev] (пакет 3.2.2): регистрация, проверка пароля, выдача JWT.
"""

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate


def register_user(db: Session, payload: UserCreate) -> User:
    """Создать пользователя с хешированным паролем и ролью viewer."""
    raise NotImplementedError("TODO [Lead Dev], пакет 3.2.2")


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Вернуть пользователя при верных учётных данных, иначе None."""
    raise NotImplementedError("TODO [Lead Dev], пакет 3.2.2")
