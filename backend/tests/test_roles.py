"""UC-04 / DoD 3.4 — разграничение ролей через require_role (401 и 403 для обеих ролей).

В спринте 1 ещё нет эндпоинтов панели контроллера (SEC-ROLE-03/04 — спринт 4),
поэтому зависимость require_role проверяется на тестовых маршрутах.
"""

from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.deps import require_role
from app.db.session import get_db
from app.models.user import User, UserRole
from tests.conftest import bearer

ControllerUser = Annotated[User, Depends(require_role(UserRole.CONTROLLER))]
AnyRoleUser = Annotated[User, Depends(require_role(UserRole.VIEWER, UserRole.CONTROLLER))]
AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@pytest.fixture
def roles_client(override_get_db) -> TestClient:
    roles_app = FastAPI()

    @roles_app.get("/controller-only")
    def controller_only(user: ControllerUser) -> dict[str, str]:
        return {"email": user.email}

    @roles_app.get("/any-role")
    def any_role(user: AnyRoleUser) -> dict[str, str]:
        return {"email": user.email}

    @roles_app.get("/admin-only")
    def admin_only(user: AdminUser) -> dict[str, str]:
        return {"email": user.email}

    roles_app.dependency_overrides[get_db] = override_get_db
    return TestClient(roles_app)


def test_viewer_gets_403_on_controller_route(roles_client, token_for) -> None:
    """UC-04 A2: viewer не имеет доступа к функциям контроллера."""
    token = token_for("viewer@test.ru")
    response = roles_client.get("/controller-only", headers=bearer(token))

    assert response.status_code == 403
    assert response.json() == {"detail": "Недостаточно прав"}


def test_controller_gets_200_on_controller_route(roles_client, token_for) -> None:
    token = token_for("controller@test.ru", role=UserRole.CONTROLLER)
    response = roles_client.get("/controller-only", headers=bearer(token))

    assert response.status_code == 200
    assert response.json() == {"email": "controller@test.ru"}


@pytest.mark.parametrize("role", [UserRole.VIEWER, UserRole.CONTROLLER])
def test_both_roles_get_200_on_shared_route(roles_client, token_for, role: UserRole) -> None:
    token = token_for(f"{role.value}@test.ru", role=role)
    assert roles_client.get("/any-role", headers=bearer(token)).status_code == 200


@pytest.mark.parametrize("role", [UserRole.VIEWER, UserRole.CONTROLLER])
def test_both_roles_get_403_without_required_role(roles_client, token_for, role: UserRole) -> None:
    """DoD 3.4: 403 для обеих ролей."""
    token = token_for(f"{role.value}@test.ru", role=role)
    assert roles_client.get("/admin-only", headers=bearer(token)).status_code == 403


@pytest.mark.parametrize("path", ["/controller-only", "/any-role", "/admin-only"])
def test_protected_routes_without_token_return_401(roles_client, path: str) -> None:
    """DoD 3.4: 401 без токена."""
    assert roles_client.get(path).status_code == 401


def test_role_is_taken_from_db_not_from_token(roles_client, token_for, db) -> None:
    """Роль понижена в БД — старый токен с role=controller уже не даёт доступа."""
    token = token_for("demoted@test.ru", role=UserRole.CONTROLLER)
    user = db.query(User).filter(User.email == "demoted@test.ru").one()
    user.role = UserRole.VIEWER
    db.commit()

    assert roles_client.get("/controller-only", headers=bearer(token)).status_code == 403
