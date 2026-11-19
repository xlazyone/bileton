"""
Вспомогательные функции для нагрузочных тестов бронирования (WBS 5.6).
Имена полей и ограничений сверены с коммитом 88d8d63 (WBS 5.2):
app/models/booking.py, app/models/seat.py, app/models/hall.py,
migration 0003_seats_bookings.
"""

import os
import threading
from typing import Any

import httpx

# --- Конфигурация API (поправить под фактический роутер 5.3) ---
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
BOOKING_ENDPOINT = "/bookings"          # POST /bookings
SEAT_FIELD = "seat_id"
SESSION_FIELD = "session_id"

# --- Конфигурация БД: значения из BookingStatus (app/models/booking.py) ---
BOOKINGS_TABLE = "bookings"
STATUS_FIELD = "status"
#: совпадает с ACTIVE_BOOKING_STATUSES в модели и _ACTIVE_STATUSES_SQL в миграции
ACTIVE_STATUSES = ("reserved", "paid")
#: частичный индекс из миграции: uq_bookings_active_seat WHERE status IN ('reserved','paid')
ACTIVE_INDEX_NAME = "uq_bookings_active_seat"


def book_seat(
    token: str,
    session_id: str,          # UUID как строка — так его принимает JSON
    seat_id: int,
    *,
    client: httpx.Client | None = None,
) -> tuple[int, dict[str, Any]]:
    """POST /bookings → (status_code, body)."""
    payload = {SESSION_FIELD: session_id, SEAT_FIELD: seat_id}
    headers = {"Authorization": f"Bearer {token}"}

    if client is not None:
        resp = client.post(BOOKING_ENDPOINT, json=payload, headers=headers)
    else:
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
            resp = c.post(BOOKING_ENDPOINT, json=payload, headers=headers)

    try:
        body = resp.json()
    except Exception:
        body = {"raw": resp.text}
    return resp.status_code, body


def count_active_bookings(conn, session_id: str, seat_id: int) -> int:
    """Активные брони на пару (session_id, seat_id) по тем же статусам, что в частичном индексе."""
    placeholders = ", ".join(["%s"] * len(ACTIVE_STATUSES))
    sql = (
        f"SELECT COUNT(*) FROM {BOOKINGS_TABLE} "
        f"WHERE {SESSION_FIELD} = %s AND {SEAT_FIELD} = %s "
        f"AND {STATUS_FIELD} IN ({placeholders})"
    )
    with conn.cursor() as cur:
        cur.execute(sql, (session_id, seat_id, *ACTIVE_STATUSES))
        return cur.fetchone()[0]


def find_duplicate_active_bookings(conn) -> list[tuple]:
    """Пары (session_id, seat_id, cnt) с дублями активных броней — должно быть пусто."""
    placeholders = ", ".join(["%s"] * len(ACTIVE_STATUSES))
    sql = (
        f"SELECT {SESSION_FIELD}, {SEAT_FIELD}, COUNT(*) AS cnt "
        f"FROM {BOOKINGS_TABLE} "
        f"WHERE {STATUS_FIELD} IN ({placeholders}) "
        f"GROUP BY {SESSION_FIELD}, {SEAT_FIELD} "
        f"HAVING COUNT(*) > 1"
    )
    with conn.cursor() as cur:
        cur.execute(sql, ACTIVE_STATUSES)
        return cur.fetchall()


def try_insert_active_booking_directly(conn, session_id: str, seat_id: int, user_id: str) -> None:
    """
    Прямая вставка активной брони в обход API — проверяет частичный уникальный индекс.
    Ожидается нарушение уникальности (psycopg2.errors.UniqueViolation / IntegrityError).
    """
    sql = (
        f"INSERT INTO {BOOKINGS_TABLE} (id, session_id, seat_id, user_id, status) "
        f"VALUES (gen_random_uuid(), %s, %s, %s, 'reserved')"
    )
    with conn.cursor() as cur:
        cur.execute(sql, (session_id, seat_id, user_id))


def run_concurrently(func, args_list: list[tuple], start_gate: threading.Event):
    """Запускает func(*args) в потоках, удерживая их на старте до start_gate.set()."""
    results: list[Any] = [None] * len(args_list)
    threads: list[threading.Thread] = []

    def worker(idx: int, args: tuple):
        start_gate.wait()
        try:
            results[idx] = func(*args)
        except Exception as exc:  # noqa: BLE001
            results[idx] = exc

    for idx, args in enumerate(args_list):
        t = threading.Thread(target=worker, args=(idx, args), daemon=True)
        t.start()
        threads.append(t)

    start_gate.set()
    for t in threads:
        t.join(timeout=60)
    return results