"""
WBS 3.2.2 | Role: [Lead Dev / Backend]
Бизнес-логика авторизации.
"""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate


def register_user(db: Session, payload: UserCreate) -> User:
    """Создать пользователя с хешированным паролем и ролью viewer."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise ValueError("Пользователь с таким email уже существует")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.VIEWER,
        is_active=True
    )

    db.add(user)
    try:
        db.commit()
    except IntegrityError as e:
        # B904: добавлено from e
        db.rollback()
        raise ValueError("Пользователь с таким email уже существует") from e

    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Вернуть пользователя при верных учётных данных, иначе None."""
    user = db.query(User).filter(User.email == email).first()

    # E501: длинное условие разбито на несколько строк
    if (
        not user
        or not verify_password(password, user.password_hash)
        or not user.is_active
    ):
        return None

    return user