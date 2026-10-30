from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "bileton-api"}


def test_auth_stub_returns_501() -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "secret123"},
    )
    assert response.status_code == 501
