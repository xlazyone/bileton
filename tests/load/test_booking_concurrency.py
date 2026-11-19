"""
Нагрузочные тесты конкурентного бронирования (WBS 5.6).
Сценарии — из описания логики блокировки (WBS 5.1, раздел 8).
Схема БД — из коммита 88d8d63 (WBS 5.2): частичный индекс uq_bookings_active_seat.
"""

import threading
import uuid

import pytest

from .helpers import (
    book_seat,
    count_active_bookings,
    find_duplicate_active_bookings,
    run_concurrently,
    try_insert_active_booking_directly,
)


def _statuses(results):
    return [r[0] if isinstance(r, tuple) else 500 for r in results]


def test_two_parallel_requests_one_seat(session_seat, auth_tokens):
    """Сценарий 1: 2 параллельных запроса на одно место → 1 успех, второй 409."""
    session_id, seat_id = session_seat
    gate = threading.Event()
    args = [
        (auth_tokens[0][0], session_id, seat_id),
        (auth_tokens[1][0], session_id, seat_id),
    ]
    statuses = _statuses(run_concurrently(book_seat, args, gate))

    assert statuses.count(201) == 1, f"ожидался 1 успех, получено: {statuses}"
    assert statuses.count(409) == 1, f"ожидался 1 конфликт, получено: {statuses}"


def test_ten_parallel_requests_one_seat(session_seat, auth_tokens):
    """Сценарий 2: 10 параллельных запросов на одно место → 1 успех, 9 × 409."""
    session_id, seat_id = session_seat
    gate = threading.Event()
    args = [(tok, session_id, seat_id) for tok, _ in auth_tokens]
    statuses = _statuses(run_concurrently(book_seat, args, gate))

    assert statuses.count(201) == 1, f"ожидался 1 успех, получено: {statuses}"
    assert statuses.count(409) == 9, f"ожидалось 9 конфликтов, получено: {statuses}"


def test_parallel_requests_different_seats(multiple_seats, auth_tokens):
    """Сценарий 3: параллельные запросы на разные места → все успешны."""
    session_id, seat_ids = multiple_seats
    gate = threading.Event()
    args = [(auth_tokens[i][0], session_id, seat_ids[i]) for i in range(len(seat_ids))]
    statuses = _statuses(run_concurrently(book_seat, args, gate))

    assert all(s == 201 for s in statuses), f"не все запросы успешны: {statuses}"


def test_repeat_request_same_user_idempotent(session_seat, auth_tokens):
    """Сценарий 4: повторный запрос того же пользователя → та же бронь, без дубля."""
    session_id, seat_id = session_seat
    token, _ = auth_tokens[0]

    status1, body1 = book_seat(token, session_id, seat_id)
    status2, body2 = book_seat(token, session_id, seat_id)

    assert status1 == 201
    assert status2 in (200, 201)
    if "id" in body1 and "id" in body2:
        assert body1["id"] == body2["id"], "повторный запрос создал новую бронь"


def test_booking_after_timeout(session_seat, auth_tokens, db_conn):
    """
    Сценарий 5: бронь → истечение TTL → повторная бронь другим пользователем.
    expires_at nullable (модель booking.py): для reserved выставляется created_at + TTL.
    """
    session_id, seat_id = session_seat

    status1, _ = book_seat(auth_tokens[0][0], session_id, seat_id)
    assert status1 == 201

    # Эмулируем истечение TTL и фоновую отмену (процесс может быть ещё не реализован)
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE bookings SET expires_at = now() - interval '1 minute', "
            "status = 'cancelled' "
            "WHERE session_id = %s AND seat_id = %s AND status = 'reserved'",
            (session_id, seat_id),
        )

    status2, _ = book_seat(auth_tokens[1][0], session_id, seat_id)
    assert status2 == 201, "место не освободилось после таймаута"


def test_cross_requests_no_deadlock(multiple_seats, auth_tokens):
    """
    Сценарий 6: встречные запросы на несколько мест в разном порядке → дедлоков нет.
    """
    session_id, seat_ids = multiple_seats
    a, b = seat_ids[0], seat_ids[1]

    def book_two(token, seat_order):
        for sid in seat_order:
            status, _ = book_seat(token, session_id, sid)
            if status not in (201, 409):
                return status
        return 201

    gate = threading.Event()
    args = [(auth_tokens[0][0], [a, b]), (auth_tokens[1][0], [b, a])]
    results = run_concurrently(book_two, args, gate)

    for r in results:
        assert not isinstance(r, Exception), f"исключение в потоке: {r}"
        assert r != 500, "внутренняя ошибка сервера (возможен дедлок)"


def test_no_duplicate_active_bookings_after_burst(session_seat, auth_tokens, db_conn):
    """Сценарий 7: после серии запросов в БД нет дублей активных броней."""
    session_id, seat_id = session_seat
    gate = threading.Event()
    args = [(tok, session_id, seat_id) for tok, _ in auth_tokens]
    run_concurrently(book_seat, args, gate)

    assert count_active_bookings(db_conn, session_id, seat_id) == 1
    assert find_duplicate_active_bookings(db_conn) == []


def test_partial_unique_index_blocks_direct_duplicate(session_seat, auth_tokens, db_conn):
    """
    Отдельная проверка схемы 5.2: частичный индекс uq_bookings_active_seat
    не даёт вставить второй активный reserved/paid даже в обход API.
    """
    session_id, seat_id = session_seat
    token0, user0 = auth_tokens[0]

    # Первая активная бронь через API
    status, _ = book_seat(token0, session_id, seat_id)
    assert status == 201

    # Вторая активная бронь — прямой INSERT, должен упасть на уникальном индексе
    import psycopg2.errors
    with pytest.raises(psycopg2.errors.UniqueViolation):
        try_insert_active_booking_directly(db_conn, session_id, seat_id, user0)


def test_cancelled_booking_does_not_block_new_reservation(session_seat, auth_tokens, db_conn):
    """
    Схема 5.2: cancelled не входит в ACTIVE_STATUSES, поэтому не мешает новой брони.
    """
    session_id, seat_id = session_seat

    status1, _ = book_seat(auth_tokens[0][0], session_id, seat_id)
    assert status1 == 201
    with db_conn.cursor() as cur:
        cur.execute(
            "UPDATE bookings SET status = 'cancelled' "
            "WHERE session_id = %s AND seat_id = %s AND status = 'reserved'",
            (session_id, seat_id),
        )

    status2, _ = book_seat(auth_tokens[1][0], session_id, seat_id)
    assert status2 == 201, "cancelled-бронь не должна блокировать новую"


def test_session_with_booking_cannot_be_deleted(db_conn, session_seat, auth_tokens):
    """
    Схема 5.2: FK bookings.session_id → sessions.id ON DELETE RESTRICT.
    """
    session_id, seat_id = session_seat
    status, _ = book_seat(auth_tokens[0][0], session_id, seat_id)
    assert status == 201

    import psycopg2.errors
    with pytest.raises(psycopg2.errors.ForeignKeyViolation):
        with db_conn.cursor() as cur:
            cur.execute("DELETE FROM sessions WHERE id = %s", (session_id,))