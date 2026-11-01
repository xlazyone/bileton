"""Общие фикстуры API-тестов модуля «Авторизация и профиль» (WBS 3.4.2).

PostgreSQL для тестов не нужен: зависимость get_db подменяется на SQLite в памяти,
поэтому тесты запускаются одной командой `pytest` — локально на Windows/macOS и в CI.
Каждый тест получает чистую базу.

Проверки, которым нужна именно PostgreSQL (хеш в pgAdmin, остановка БД, логи сервера),
выполняются вручную по docs/requirements/security-checklist.md.
"""

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole

PASSWORD = "password123"


@pytest.fixture
def session_factory() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # одна общая in-memory база на все соединения теста
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def override_get_db(session_factory: sessionmaker[Session]) -> Callable[[], Iterator[Session]]:
    def _get_db() -> Iterator[Session]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    return _get_db


@pytest.fixture
def client(override_get_db: Callable[[], Iterator[Session]]) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def db(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    """Сессия для проверок «что лежит в таблице users»."""
    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def register(client: TestClient):
    """register(email, password=..., **extra) -> Response для POST /api/auth/register."""

    def _register(email: str, password: str = PASSWORD, **extra):
        body = {"email": email, "password": password, "password_confirm": password, **extra}
        return client.post("/api/auth/register", json=body)

    return _register


@pytest.fixture
def login(client: TestClient):
    """login(email, password=...) -> Response для POST /api/auth/login."""

    def _login(email: str, password: str = PASSWORD):
        return client.post("/api/auth/login", json={"email": email, "password": password})

    return _login


@pytest.fixture
def token_for(register, login, db: Session):
    """token_for(email, role=VIEWER) — регистрирует пользователя, при необходимости
    меняет роль прямо в БД (как это делает администратор) и возвращает JWT."""

    def _token_for(email: str, role: UserRole = UserRole.VIEWER) -> str:
        assert register(email).status_code == 201
        if role is not UserRole.VIEWER:
            user = db.query(User).filter(User.email == email).one()
            user.role = role
            db.commit()
        response = login(email)
        assert response.status_code == 200
        return response.json()["access_token"]

    return _token_for


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
