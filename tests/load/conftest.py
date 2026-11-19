"""
Фикстуры для нагрузочных тестов (WBS 5.6).
Схема сверена с коммитом 88d8d63: halls(rows_count, seats_per_row),
seats(hall_id, row_number, seat_number), bookings(UUID id, session_id UUID,
seat_id int, user_id UUID, status, created_at, expires_at).
"""

import os
import uuid

import psycopg2
import pytest
from dotenv import load_dotenv

load_dotenv()

DB_DSN = os.getenv(
    "TEST_DB_DSN",
    "postgresql://postgres:postgres@localhost:5432/bileton_test",
)


@pytest.fixture(scope="session")
def db_conn():
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture
def clean_bookings(db_conn):
    with db_conn.cursor() as cur:
        cur.execute("TRUNCATE TABLE bookings RESTART IDENTITY CASCADE")
    yield


@pytest.fixture
def session_seat(db_conn, clean_bookings):
    """
    Создаёт зал, сеанс и одно свободное место.
    Возвращает (session_id: str, seat_id: int).
    """
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO halls (name, rows_count, seats_per_row) "
            "VALUES ('LoadTest Hall', 2, 3) RETURNING id"
        )
        hall_id = cur.fetchone()[0]

        # movie из пакета 4.2 — нужен для сеанса
        cur.execute(
            "INSERT INTO movies (title, genres, duration_minutes, age_rating) "
            "VALUES ('LoadTest Movie', '[]', 100, '12+') RETURNING id"
        )
        movie_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO sessions (movie_id, hall_id, starts_at, price) "
            "VALUES (%s, %s, now() + interval '1 day', 450) RETURNING id",
            (movie_id, hall_id),
        )
        session_id = str(cur.fetchone()[0])

        cur.execute(
            "INSERT INTO seats (hall_id, row_number, seat_number) "
            "VALUES (%s, 1, 1) RETURNING id",
            (hall_id,),
        )
        seat_id = cur.fetchone()[0]

    yield session_id, seat_id


@pytest.fixture
def multiple_seats(db_conn, clean_bookings):
    """Один сеанс и 10 свободных мест. Возвращает (session_id, [seat_ids])."""
    n = 10
    with db_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO halls (name, rows_count, seats_per_row) "
            "VALUES ('LoadTest Hall', 10, 10) RETURNING id"
        )
        hall_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO movies (title, genres, duration_minutes, age_rating) "
            "VALUES ('LoadTest Movie', '[]', 100, '12+') RETURNING id"
        )
        movie_id = cur.fetchone()[0]

        cur.execute(
            "INSERT INTO sessions (movie_id, hall_id, starts_at, price) "
            "VALUES (%s, %s, now() + interval '1 day', 450) RETURNING id",
            (movie_id, hall_id),
        )
        session_id = str(cur.fetchone()[0])

        seat_ids = []
        for i in range(1, n + 1):
            cur.execute(
                "INSERT INTO seats (hall_id, row_number, seat_number) "
                "VALUES (%s, 1, %s) RETURNING id",
                (hall_id, i),
            )
            seat_ids.append(cur.fetchone()[0])

    yield session_id, seat_ids


@pytest.fixture
def auth_tokens(db_conn):
    """
    10 тестовых пользователей (UUID из users) и токенов для них.
    TODO: заменить на реальную выдачу JWT из пакета 3.3.
    """
    n = 10
    tokens, user_ids = [], []
    with db_conn.cursor() as cur:
        for _ in range(n):
            email = f"loadtest_{uuid.uuid4().hex[:8]}@example.com"
            cur.execute(
                "INSERT INTO users (email, password_hash) "
                "VALUES (%s, 'hash') RETURNING id",
                (email,),
            )
            user_id = str(cur.fetchone()[0])
            user_ids.append(user_id)
            tokens.append(f"test-token-{user_id}")

    # Отдаём и токены, и user_id — user_id нужен для прямой вставки в БД
    return list(zip(tokens, user_ids))