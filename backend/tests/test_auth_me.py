"""UC-03/UC-04 — GET /api/auth/me и валидация JWT (DoD 3.3–3.4, SEC-JWT/ROLE/SESS)."""

import base64
import json
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from tests.conftest import bearer


def b64url(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def b64url_decode(part: str) -> dict:
    return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))


def make_token(sub: str | None, *, role: str = "viewer", minutes: int = 60, **overrides) -> str:
    """Токен, подписанный настоящим секретом сервера."""
    now = datetime.now(UTC)
    payload = {"sub": sub, "role": role, "iat": now, "exp": now + timedelta(minutes=minutes)}
    payload.update(overrides)
    if sub is None:
        del payload["sub"]
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def test_returns_profile_for_valid_token(client, register, login) -> None:
    profile = register("me@test.ru", full_name="Антон").json()
    token = login("me@test.ru").json()["access_token"]

    response = client.get("/api/auth/me", headers=bearer(token))

    assert response.status_code == 200
    assert response.json() == profile
    assert "password" not in response.text  # SEC-AUTH-03


def test_without_authorization_header_returns_401(client) -> None:
    """SEC-ROLE-01, UC-04 A1."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.parametrize("header", ["Bearer abc", "Bearer ", "Basic dXNlcjpwYXNz", "abc"])
def test_malformed_token_returns_401(client, header: str) -> None:
    """SEC-ROLE-02."""
    response = client.get("/api/auth/me", headers={"Authorization": header})
    assert response.status_code == 401


def test_tampered_signature_returns_401(client, token_for) -> None:
    """SEC-JWT-03: изменён символ подписи."""
    header, payload, signature = token_for("sig@test.ru").split(".")
    first = "B" if signature[0] != "B" else "C"  # первый символ base64 несёт 6 значащих бит
    tampered = f"{header}.{payload}.{first}{signature[1:]}"

    assert client.get("/api/auth/me", headers=bearer(tampered)).status_code == 401


def test_role_changed_in_payload_returns_401(client, token_for) -> None:
    """SEC-ROLE-05: подмена роли без знания секрета."""
    header, payload, signature = token_for("role@test.ru").split(".")
    data = b64url_decode(payload)
    data["role"] = "controller"
    forged = f"{header}.{b64url(data)}.{signature}"

    assert client.get("/api/auth/me", headers=bearer(forged)).status_code == 401


def test_alg_none_token_returns_401(client, token_for) -> None:
    """SEC-JWT-04: токен без подписи."""
    _, payload, _ = token_for("none@test.ru").split(".")
    unsigned = f"{b64url({'alg': 'none', 'typ': 'JWT'})}.{payload}."

    assert client.get("/api/auth/me", headers=bearer(unsigned)).status_code == 401


def test_other_algorithm_returns_401(client, register, login) -> None:
    """SEC-JWT-04: алгоритм берётся из настроек сервера, а не из заголовка токена."""
    user_id = register("hs512@test.ru").json()["id"]
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": user_id, "role": "viewer", "iat": now, "exp": now + timedelta(minutes=5)},
        settings.jwt_secret_key + "-other-algorithm",
        algorithm="HS512",
    )

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_expired_token_returns_401(client, register) -> None:
    """SEC-JWT-05, SEC-SESS-03, UC-03 A1."""
    user_id = register("expired@test.ru").json()["id"]
    token = make_token(user_id, minutes=-1)

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_token_signed_with_other_secret_returns_401(client, register) -> None:
    user_id = register("secret@test.ru").json()["id"]
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": user_id, "role": "viewer", "exp": now + timedelta(minutes=5)},
        "not-the-server-secret",
        algorithm=settings.jwt_algorithm,
    )

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


@pytest.mark.parametrize("sub", [None, "not-a-uuid", str(uuid.uuid4())])
def test_token_without_existing_user_returns_401(client, sub: str | None) -> None:
    """Подпись верная, но sub отсутствует, некорректен или такого пользователя нет."""
    assert client.get("/api/auth/me", headers=bearer(make_token(sub))).status_code == 401


def test_token_of_deactivated_user_returns_401(client, token_for, db: Session) -> None:
    token = token_for("deactivated@test.ru")
    user = db.query(User).filter(User.email == "deactivated@test.ru").one()
    user.is_active = False
    db.commit()

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_token_is_not_revoked_on_server_mvp_limitation(client, token_for) -> None:
    """SEC-JWT-08: выход удаляет токен только на клиенте; серверного отзыва нет,
    токен действует до exp. Осознанное ограничение MVP — тест фиксирует поведение."""
    token = token_for("logout@test.ru")

    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 200
