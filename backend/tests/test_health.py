from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "bileton-api"}


def test_root_points_to_docs() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"service": "bileton-api", "docs": "/docs"}
