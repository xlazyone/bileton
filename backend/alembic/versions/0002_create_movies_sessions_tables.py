"""create movies and sessions tables

Revision ID: 0002_movies_sessions
Revises: 0001_users
Create Date: 2026-11-09 12:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_movies_sessions"
down_revision: str | None = "0001_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "movies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("genres", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("age_rating", sa.String(length=10), nullable=False),
        sa.Column("poster_url", sa.String(length=500), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("duration_minutes > 0", name="ck_movies_duration_positive"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_movies_title"), "movies", ["title"], unique=False)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("movie_id", sa.Uuid(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("hall", sa.String(length=50), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("price >= 0", name="ck_sessions_price_non_negative"),
        sa.ForeignKeyConstraint(["movie_id"], ["movies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sessions_movie_id_starts_at",
        "sessions",
        ["movie_id", "starts_at"],
        unique=False,
    )
    op.create_index(op.f("ix_sessions_starts_at"), "sessions", ["starts_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sessions_starts_at"), table_name="sessions")
    op.drop_index("ix_sessions_movie_id_starts_at", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(op.f("ix_movies_title"), table_name="movies")
    op.drop_table("movies")
