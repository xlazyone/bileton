"""UC-02 «Вход» — POST /api/auth/login (DoD 3.2, SEC-JWT/ERR)."""

import jwt
import pytest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User

INVALID_CREDENTIALS = {"detail": "Неверный email или пароль"}


def test_success_returns_token(register, login) -> None:
    register("viewer@test.ru")
    response = login("viewer@test.ru")

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "viewer"
    assert body["access_token"]


def test_token_payload_has_sub_role_exp_and_no_secrets(register, login) -> None:
    """SEC-JWT-02 + DoD 3.2: JWT содержит user_id и role, срок жизни задан."""
    user_id = register("payload@test.ru").json()["id"]
    token = login("payload@test.ru").json()["access_token"]

    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

    assert payload["sub"] == user_id
    assert payload["role"] == "viewer"
    assert payload["exp"] - payload["iat"] == settings.access_token_expire_minutes * 60
    assert not {"password", "password_hash", "email"} & set(payload)


def test_wrong_password_returns_401(register, login) -> None:
    """UC-02 A2, SEC-JWT-01, SEC-ERR-02."""
    register("wrong@test.ru")
    response = login("wrong@test.ru", password="wrong-password")

    assert response.status_code == 401
    assert response.json() == INVALID_CREDENTIALS
    assert "access_token" not in response.text


def test_unknown_email_returns_401(login) -> None:
    """SEC-JWT-01."""
    response = login("nobody@test.ru")

    assert response.status_code == 401
    assert response.json() == INVALID_CREDENTIALS


def test_wrong_password_and_unknown_email_are_indistinguishable(register, login) -> None:
    """SEC-ERR-01: по ответу нельзя понять, существует ли email."""
    register("exists@test.ru")
    wrong_password = login("exists@test.ru", password="wrong-password")
    unknown_email = login("nobody@test.ru", password="wrong-password")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_sql_injection_in_password_returns_401(register, login) -> None:
    """SEC-IN-02 (пароль): строка уходит параметром, а не в текст SQL."""
    register("sqli@test.ru")
    response = login("sqli@test.ru", password="' OR 1=1 --")

    assert response.status_code == 401
    assert response.json() == INVALID_CREDENTIALS


@pytest.mark.parametrize(
    "body",
    [
        {"email": "", "password": ""},
        {"email": "", "password": "password123"},
        {"email": "empty@test.ru"},
        {"password": "password123"},
        {},
    ],
)
def test_empty_fields_do_not_log_in(client, body: dict) -> None:
    """UC-02 A1: пустые поля — входа нет (422 от валидации)."""
    response = client.post("/api/auth/login", json=body)

    assert response.status_code == 422
    assert "access_token" not in response.text


def test_empty_password_does_not_log_in(register, login) -> None:
    register("emptypass@test.ru")
    response = login("emptypass@test.ru", password="")

    assert response.status_code in (401, 422)
    assert "access_token" not in response.text


def test_inactive_user_cannot_log_in(register, login, db: Session) -> None:
    register("blocked@test.ru")
    user = db.query(User).filter(User.email == "blocked@test.ru").one()
    user.is_active = False
    db.commit()

    response = login("blocked@test.ru")

    assert response.status_code == 401
    assert response.json() == INVALID_CREDENTIALS
