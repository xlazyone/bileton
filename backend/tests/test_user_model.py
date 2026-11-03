from app.models.user import User, UserRole


def test_users_table_has_required_columns() -> None:
    columns = set(User.__table__.columns.keys())
    assert {
        "id",
        "email",
        "password_hash",
        "full_name",
        "role",
        "is_active",
        "created_at",
        "updated_at",
    } <= columns


def test_email_is_unique_and_indexed() -> None:
    email_column = User.__table__.columns["email"]
    assert email_column.unique is True
    assert email_column.index is True


def test_default_role_is_viewer() -> None:
    role_column = User.__table__.columns["role"]
    assert role_column.default.arg is UserRole.VIEWER
