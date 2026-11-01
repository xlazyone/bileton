"""Сквозные проверки безопасности: утечки в ответах, CORS (SEC-AUTH-03, SEC-TR-03)."""

import pytest

from tests.conftest import PASSWORD, bearer

TRUSTED_ORIGIN = "http://localhost:5173"


def test_success_responses_do_not_leak_password(client, register, login) -> None:
    """SEC-AUTH-03: успешные ответы."""
    responses = [register("leak@test.ru")]
    responses.append(login("leak@test.ru"))
    token = responses[-1].json()["access_token"]
    responses.append(client.get("/api/auth/me", headers=bearer(token)))

    for response in responses:
        assert response.status_code in (200, 201)
        assert PASSWORD not in response.text
        assert "password_hash" not in response.text


def test_error_responses_do_not_leak_password_hash(register, login) -> None:
    """SEC-AUTH-03: ошибки 401 и 409 не раскрывают данные пользователя."""
    register("leak2@test.ru")
    responses = [register("leak2@test.ru"), login("leak2@test.ru", password="wrong-password")]

    for response in responses:
        assert response.status_code in (401, 409)
        assert "password_hash" not in response.text
        assert "$argon2" not in response.text


@pytest.mark.xfail(
    strict=True,
    reason="БАГ SEC-AUTH-03: ответ 422 от FastAPI/Pydantic возвращает введённый пароль "
    "в поле detail[].input",
)
def test_validation_errors_do_not_echo_password(register) -> None:
    secret = "Secret7"  # 7 символов — гарантированная ошибка валидации
    response = register("echo@test.ru", password=secret)

    assert response.status_code == 422
    assert secret not in response.text


def test_cors_rejects_untrusted_origin(client) -> None:
    """SEC-TR-03: чужой origin не получает Access-Control-Allow-Origin."""
    response = client.options(
        "/api/auth/login",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_allows_frontend_origin(client) -> None:
    response = client.options(
        "/api/auth/login",
        headers={"Origin": TRUSTED_ORIGIN, "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == TRUSTED_ORIGIN


def test_cors_does_not_allow_127_0_0_1_origin(client) -> None:
    """В CORS разрешён только localhost:5173 — фронтенд надо открывать по localhost."""
    response = client.options(
        "/api/auth/login",
        headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "POST"},
    )

    assert "access-control-allow-origin" not in response.headers
