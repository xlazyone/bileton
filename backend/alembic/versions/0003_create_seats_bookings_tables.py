"""create seats and bookings tables, extend halls

Revision ID: 0003_seats_bookings
Revises: 0002_movies_sessions
Create Date: 2026-11-18 12:00:00

WBS 5.2: структура таблиц halls, seats, bookings.
Требования к схеме — docs/requirements/seat-reservation-logic.md, раздел 7.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_seats_bookings"
down_revision: str | None = "0002_movies_sessions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ACTIVE_STATUSES_SQL = "status IN ('reserved', 'paid')"
BOOKING_STATUS_VALUES = ("reserved", "paid", "used", "cancelled")


def upgrade() -> None:
    # Сетка зала для вёрстки схемы мест (WBS 5.4)
    op.add_column(
        "halls",
        sa.Column("rows_count", sa.Integer(), server_default="10", nullable=False),
    )
    op.add_column(
        "halls",
        sa.Column("seats_per_row", sa.Integer(), server_default="12", nullable=False),
    )

    op.create_table(
        "seats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("hall_id", sa.Integer(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("seat_number", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["hall_id"], ["halls.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hall_id", "row_number", "seat_number", name="uq_seats_hall_coords"),
    )
    op.create_index(op.f("ix_seats_hall_id"), "seats", ["hall_id"])

    op.create_table(
        "bookings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("seat_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(*BOOKING_STATUS_VALUES, name="booking_status"),
            server_default="reserved",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["seat_id"], ["seats.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bookings_seat_id"), "bookings", ["seat_id"])
    op.create_index(op.f("ix_bookings_user_id"), "bookings", ["user_id"])
    op.create_index("ix_bookings_expires_at", "bookings", ["expires_at"])
    # Страховка поверх SELECT ... FOR UPDATE: одно место — одна активная бронь
    op.create_index(
        "uq_bookings_active_seat",
        "bookings",
        ["session_id", "seat_id"],
        unique=True,
        postgresql_where=sa.text(ACTIVE_STATUSES_SQL),
        sqlite_where=sa.text(ACTIVE_STATUSES_SQL),
    )


def downgrade() -> None:
    op.drop_index("uq_bookings_active_seat", table_name="bookings")
    op.drop_index("ix_bookings_expires_at", table_name="bookings")
    op.drop_index(op.f("ix_bookings_user_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_seat_id"), table_name="bookings")
    op.drop_table("bookings")
    if op.get_bind().dialect.name == "postgresql":
        sa.Enum(name="booking_status").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_seats_hall_id"), table_name="seats")
    op.drop_table("seats")

    op.drop_column("halls", "seats_per_row")
    op.drop_column("halls", "rows_count")
