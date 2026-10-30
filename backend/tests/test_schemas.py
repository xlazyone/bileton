import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate


def test_short_password_is_rejected() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            email="user@example.com",
            password="short",
            password_confirm="short",
        )


def test_password_mismatch_is_rejected() -> None:
    with pytest.raises(ValidationError):
        UserCreate(
            email="user@example.com",
            password="password123",
            password_confirm="password124",
        )


def test_valid_registration_payload() -> None:
    payload = UserCreate(
        email="user@example.com",
        password="password123",
        password_confirm="password123",
        full_name="Иван",
    )
    assert payload.email == "user@example.com"
    assert payload.full_name == "Иван"
