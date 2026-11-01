"""UC-01 «Регистрация» — POST /api/auth/register (DoD 3.1, SEC-AUTH/IN/ROLE)."""

import pytest
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.user import User, UserRole
from tests.conftest import PASSWORD

USER_READ_FIELDS = {"id", "email", "full_name", "role", "is_active", "created_at"}


def users_count(db: Session) -> int:
    return db.query(User).count()


def test_success_returns_201_and_profile(register) -> None:
    response = register("anton@test.ru", full_name="Антон")

    assert response.status_code == 201
    body = response.json()
    assert set(body) == USER_READ_FIELDS  # SEC-AUTH-03: ни password, ни password_hash
    assert body["email"] == "anton@test.ru"
    assert body["full_name"] == "Антон"
    assert body["role"] == "viewer"  # роль по умолчанию
    assert body["is_active"] is True


def test_password_is_stored_as_argon2_hash(register, db: Session) -> None:
    """SEC-AUTH-01: в password_hash хеш с солью, открытого пароля нет."""
    register("hash@test.ru")
    user = db.query(User).filter(User.email == "hash@test.ru").one()

    assert user.password_hash != PASSWORD
    assert PASSWORD not in user.password_hash
    assert user.password_hash.startswith("$argon2")
    assert verify_password(PASSWORD, user.password_hash)


def test_same_password_gives_different_hashes(register, db: Session) -> None:
    """SEC-AUTH-01: соль — одинаковые пароли дают разные хеши."""
    register("salt1@test.ru")
    register("salt2@test.ru")
    hashes = {user.password_hash for user in db.query(User).all()}
    assert len(hashes) == 2


def test_duplicate_email_returns_409(register, db: Session) -> None:
    """UC-01 A4, SEC-ERR-05."""
    assert register("dup@test.ru").status_code == 201
    response = register("dup@test.ru")

    assert response.status_code == 409
    assert response.json() == {"detail": "Пользователь с таким email уже существует"}
    assert users_count(db) == 1


@pytest.mark.xfail(
    strict=True,
    reason="БАГ: email сравнивается с учётом регистра — User@test.ru и user@test.ru "
    "становятся двумя аккаунтами",
)
def test_duplicate_email_is_case_insensitive(register) -> None:
    assert register("Case@test.ru").status_code == 201
    assert register("case@test.ru").status_code == 409


def test_short_password_returns_422(register, db: Session) -> None:
    """UC-01 A2, SEC-AUTH-05: 7 символов — ошибка, пользователь не создан."""
    response = register("short@test.ru", password="1234567")

    assert response.status_code == 422
    assert users_count(db) == 0


def test_password_of_8_chars_without_complexity_is_accepted(register) -> None:
    """SEC-AUTH-06: проверки сложности нет."""
    assert register("simple@test.ru", password="aaaaaaaa").status_code == 201


def test_password_mismatch_returns_422(client, db: Session) -> None:
    """UC-01 A3, SEC-AUTH-08."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "mismatch@test.ru",
            "password": "password123",
            "password_confirm": "password124",
        },
    )

    assert response.status_code == 422
    assert "Пароли не совпадают" in response.text
    assert users_count(db) == 0


@pytest.mark.parametrize("email", ["user@", "user", "", "' OR 1=1 --", "user@@test.ru"])
def test_invalid_email_returns_422(register, db: Session, email: str) -> None:
    """UC-01 A1, SEC-IN-01, SEC-IN-02 (email)."""
    response = register(email)

    assert response.status_code == 422
    assert users_count(db) == 0


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("full_name", "a" * 256),
        ("password", "a" * 129),
        ("email", "a" * 250 + "@test.ru"),
    ],
)
def test_values_over_limits_return_422(client, field: str, value: str) -> None:
    """SEC-IN-04."""
    body = {
        "email": "limits@test.ru",
        "password": PASSWORD,
        "password_confirm": PASSWORD,
        "full_name": "QA",
    }
    body[field] = value
    if field == "password":
        body["password_confirm"] = value

    assert client.post("/api/auth/register", json=body).status_code == 422


@pytest.mark.parametrize("missing", ["email", "password", "password_confirm"])
def test_missing_required_field_returns_422(client, missing: str) -> None:
    """SEC-IN-05: обязательные поля."""
    body = {"email": "missing@test.ru", "password": PASSWORD, "password_confirm": PASSWORD}
    del body[missing]

    assert client.post("/api/auth/register", json=body).status_code == 422


@pytest.mark.xfail(
    strict=True,
    reason="БАГ SEC-IN-05: пароль из одних пробелов проходит валидацию "
    "(min_length считает пробелы)",
)
def test_whitespace_only_password_returns_422(register) -> None:
    assert register("spaces@test.ru", password=" " * 8).status_code == 422


def test_role_from_request_is_ignored(register, db: Session) -> None:
    """SEC-ROLE-07: поле role в запросе не позволяет назначить себе роль."""
    response = register("hacker@test.ru", role="controller")

    assert response.status_code == 201
    assert response.json()["role"] == "viewer"
    user = db.query(User).filter(User.email == "hacker@test.ru").one()
    assert user.role is UserRole.VIEWER
