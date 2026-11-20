"""WBS 5.6 / 5.7 — нагрузочные тесты бронирования (pytest + threads) и проверка отката транзакции.

Сценарии — docs/requirements/seat-reservation-logic.md, раздел 8.

SELECT ... FOR UPDATE работает только в PostgreSQL (SQLite его игнорирует), поэтому тесты
запускаются на ОТДЕЛЬНОЙ тестовой базе PostgreSQL и пропускаются, если она не задана:

    # создать базу один раз
    createdb -U bileton bileton_test
    # запуск
    BILETON_TEST_POSTGRES_URL=postgresql+psycopg://bileton:bileton@localhost:5432/bileton_test \\
        pytest tests/test_booking_concurrency.py -v

ВНИМАНИЕ: перед каждым тестом таблицы тестовой базы пересоздаются. Имя базы обязано
содержать «test», чтобы случайно не стереть рабочую.

Каждый поток — отдельный «пользователь» со своим TestClient и своим соединением с БД,
старт синхронизирован threading.Barrier, поэтому запросы приходят в PostgreSQL одновременно.
"""

import os
import threading
import uuid
from collections import Counter
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from functools import partial

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.booking import ACTIVE_BOOKING_STATUSES, Booking, BookingStatus
from app.models.hall import Hall
from app.models.movie import Movie
from app.models.seat import Seat
from app.models.session import Session as MovieSession
from app.models.user import User

POSTGRES_URL = os.environ.get("BILETON_TEST_POSTGRES_URL")

pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="нужна тестовая PostgreSQL: задайте BILETON_TEST_POSTGRES_URL (см. docstring модуля)",
)

ROWS, SEATS_PER_ROW = 3, 10
BOOKINGS_URL = "/api/bookings"


# --------------------------------------------------------------------------- фикстуры


@pytest.fixture(scope="module")
def pg_engine() -> Iterator[Engine]:
    url = make_url(POSTGRES_URL)
    if "test" not in (url.database or ""):
        pytest.fail(f"База «{url.database}» не похожа на тестовую: в имени должно быть «test»")
    engine = create_engine(url, pool_size=30, max_overflow=30, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture
def pg_factory(pg_engine: Engine) -> Iterator[sessionmaker[Session]]:
    Base.metadata.drop_all(pg_engine)
    with pg_engine.begin() as connection:
        connection.execute(text("DROP TYPE IF EXISTS booking_status"))
    Base.metadata.create_all(pg_engine)
    factory = sessionmaker(bind=pg_engine, autoflush=False, expire_on_commit=False)

    def _get_db() -> Iterator[Session]:
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    yield factory
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def cinema(pg_factory: sessionmaker[Session]) -> dict:
    """Зал 3×10, фильм и сеанс завтра. Возвращает id сеанса и seat_id по (ряд, место)."""
    with pg_factory() as db:
        movie = Movie(
            title="Код доступа", genres=["триллер"], duration_minutes=114, age_rating="16+"
        )
        hall = Hall(name="Зал 1", rows_count=ROWS, seats_per_row=SEATS_PER_ROW)
        other_hall = Hall(name="Зал 2", rows_count=1, seats_per_row=1)
        db.add_all([movie, hall, other_hall])
        db.flush()
        seats = [
            Seat(hall_id=hall.id, row_number=row, seat_number=number)
            for row in range(1, ROWS + 1)
            for number in range(1, SEATS_PER_ROW + 1)
        ]
        foreign_seat = Seat(hall_id=other_hall.id, row_number=1, seat_number=1)
        db.add_all([*seats, foreign_seat])
        movie_session = MovieSession(
            movie_id=movie.id,
            hall_id=hall.id,
            starts_at=datetime.now(UTC) + timedelta(days=1),
            price=450,
        )
        db.add(movie_session)
        db.commit()
        return {
            "session_id": movie_session.id,
            "seat": {(s.row_number, s.seat_number): s.id for s in seats},
            "foreign_seat_id": foreign_seat.id,
        }


@pytest.fixture
def make_users(pg_factory: sessionmaker[Session]) -> Callable[[int], list[dict]]:
    """make_users(n) -> [{'id', 'token'}] — n зрителей с готовыми JWT."""
    password_hash = hash_password("password123")

    def _make(count: int) -> list[dict]:
        with pg_factory() as db:
            users = [
                User(email=f"load-{uuid.uuid4().hex[:10]}@test.ru", password_hash=password_hash)
                for _ in range(count)
            ]
            db.add_all(users)
            db.commit()
            return [
                {"id": user.id, "token": create_access_token(str(user.id), user.role.value)}
                for user in users
            ]

    return _make


# --------------------------------------------------------------------------- помощники


def post_booking(token: str, session_id: uuid.UUID, seat_id: int) -> tuple[int, dict]:
    with TestClient(app) as client:
        response = client.post(
            BOOKINGS_URL,
            json={"session_id": str(session_id), "seat_id": seat_id},
            headers={"Authorization": f"Bearer {token}"},
        )
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}
    return response.status_code, body


def run_parallel(tasks: list[Callable[[], tuple[int, dict]]]) -> list[tuple[int, dict]]:
    """Запускает задачи в отдельных потоках строго одновременно (Barrier)."""
    barrier = threading.Barrier(len(tasks))

    def runner(task):
        barrier.wait(timeout=30)
        return task()

    with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        futures = [pool.submit(runner, task) for task in tasks]
        return [future.result(timeout=120) for future in futures]


def active_bookings(factory: sessionmaker[Session], session_id: uuid.UUID) -> list[Booking]:
    with factory() as db:
        return list(
            db.scalars(
                select(Booking).where(
                    Booking.session_id == session_id,
                    Booking.status.in_(ACTIVE_BOOKING_STATUSES),
                )
            )
        )


def assert_no_duplicate_active_bookings(factory: sessionmaker[Session]) -> None:
    """Сценарий 7: нет дублей (session_id, seat_id) среди активных броней."""
    with factory() as db:
        duplicates = db.execute(
            select(Booking.session_id, Booking.seat_id, func.count())
            .where(Booking.status.in_(ACTIVE_BOOKING_STATUSES))
            .group_by(Booking.session_id, Booking.seat_id)
            .having(func.count() > 1)
        ).all()
    assert duplicates == []


def assert_conflict_body(body: dict, session_id: uuid.UUID, seat_id: int) -> None:
    """Контракт 409 (seat-reservation-logic.md, раздел 5)."""
    detail = body["detail"]
    assert detail["code"] == "SEAT_ALREADY_BOOKED"
    assert detail["session_id"] == str(session_id)
    assert detail["seat_id"] == seat_id
    assert detail["message"]


# --------------------------------------------------------------------------- сценарии


def test_scenario_1_two_parallel_requests_one_seat(pg_factory, cinema, make_users) -> None:
    """1. Два параллельных запроса на одно место: ровно 1 успех, второй — 409."""
    users = make_users(2)
    seat_id = cinema["seat"][(1, 5)]

    results = run_parallel(
        [lambda u=u: post_booking(u["token"], cinema["session_id"], seat_id) for u in users]
    )

    assert sorted(code for code, _ in results) == [201, 409]
    conflict = next(body for code, body in results if code == 409)
    assert_conflict_body(conflict, cinema["session_id"], seat_id)
    assert len(active_bookings(pg_factory, cinema["session_id"])) == 1


@pytest.mark.parametrize("attempt", range(5))
def test_scenario_2_ten_parallel_requests_one_seat(pg_factory, cinema, make_users, attempt) -> None:
    """2. Десять параллельных запросов на одно место: 1 успех, 9 × 409.
    Повторяется 5 раз — критерий 5.6 «тест воспроизводим при повторных запусках»."""
    users = make_users(10)
    seat_id = cinema["seat"][(2, 5)]

    results = run_parallel(
        [lambda u=u: post_booking(u["token"], cinema["session_id"], seat_id) for u in users]
    )

    assert Counter(code for code, _ in results) == {201: 1, 409: 9}
    bookings = active_bookings(pg_factory, cinema["session_id"])
    assert len(bookings) == 1
    winner = next(body for code, body in results if code == 201)
    assert bookings[0].id == uuid.UUID(winner["id"])
    assert_no_duplicate_active_bookings(pg_factory)


def test_scenario_3_parallel_requests_different_seats(pg_factory, cinema, make_users) -> None:
    """3. Параллельные запросы на разные места: все успешны, блокировки не мешают."""
    users = make_users(10)
    seat_ids = [cinema["seat"][(3, number)] for number in range(1, 11)]

    results = run_parallel(
        [
            lambda u=u, s=s: post_booking(u["token"], cinema["session_id"], s)
            for u, s in zip(users, seat_ids, strict=True)
        ]
    )

    assert [code for code, _ in results] == [201] * 10
    booked = {booking.seat_id for booking in active_bookings(pg_factory, cinema["session_id"])}
    assert booked == set(seat_ids)


def test_scenario_4_same_user_repeats_request(pg_factory, cinema, make_users) -> None:
    """4. Повторный запрос того же пользователя (двойной клик, 5 параллельно):
    возвращается одна и та же бронь, дубля нет."""
    [user] = make_users(1)
    seat_id = cinema["seat"][(1, 1)]

    results = run_parallel(
        [lambda: post_booking(user["token"], cinema["session_id"], seat_id) for _ in range(5)]
    )

    assert {code for code, _ in results} <= {200, 201}
    assert len({body["id"] for _, body in results}) == 1
    assert len(active_bookings(pg_factory, cinema["session_id"])) == 1


def test_scenario_5_booking_after_timeout(pg_factory, cinema, make_users) -> None:
    """5. Бронь после истечения таймаута: место снова свободно, новая бронь успешна,
    просроченная переводится в cancelled (исправление PR #20)."""
    first, second = make_users(2)
    seat_id = cinema["seat"][(1, 2)]
    with pg_factory() as db:
        db.add(
            Booking(
                session_id=cinema["session_id"],
                seat_id=seat_id,
                user_id=first["id"],
                status=BookingStatus.RESERVED,
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        db.commit()

    code, body = post_booking(second["token"], cinema["session_id"], seat_id)

    assert code == 201, body
    [active] = active_bookings(pg_factory, cinema["session_id"])
    assert active.user_id == second["id"]
    with pg_factory() as db:
        statuses = db.scalars(select(Booking.status).where(Booking.seat_id == seat_id)).all()
    assert sorted(s.value for s in statuses) == ["cancelled", "reserved"]


def test_scenario_5_parallel_requests_on_expired_seat(pg_factory, cinema, make_users) -> None:
    """5 + гонка: место освободилось по таймауту, на него одновременно 10 запросов —
    ровно одна новая бронь, остальные 409."""
    [owner, *users] = make_users(11)
    seat_id = cinema["seat"][(1, 3)]
    with pg_factory() as db:
        db.add(
            Booking(
                session_id=cinema["session_id"],
                seat_id=seat_id,
                user_id=owner["id"],
                status=BookingStatus.RESERVED,
                expires_at=datetime.now(UTC) - timedelta(minutes=1),
            )
        )
        db.commit()

    results = run_parallel(
        [partial(post_booking, u["token"], cinema["session_id"], seat_id) for u in users]
    )

    assert Counter(code for code, _ in results) == {201: 1, 409: 9}
    assert len(active_bookings(pg_factory, cinema["session_id"])) == 1
    assert_no_duplicate_active_bookings(pg_factory)


def test_scenario_6_crossing_requests_no_deadlock(pg_factory, cinema, make_users) -> None:
    """6. Встречные запросы на несколько мест в разном порядке: дедлоков нет.

    POST /bookings бронирует одно место за запрос, поэтому «бронь нескольких мест»
    моделируется серией запросов: половина пользователей идёт по местам слева направо,
    половина — справа налево. Ожидаем только 201/409 (ни 500, ни зависаний),
    у каждого места ровно одна активная бронь.
    """
    users = make_users(8)
    seat_ids = [cinema["seat"][(2, number)] for number in range(1, 5)]

    def book_series(user, order):
        return [post_booking(user["token"], cinema["session_id"], seat) for seat in order]

    tasks = [
        (lambda u=u, order=(seat_ids if i % 2 == 0 else seat_ids[::-1]): (0, book_series(u, order)))
        for i, u in enumerate(users)
    ]
    series = [results for _, results in run_parallel(tasks)]

    codes = Counter(code for results in series for code, _ in results)
    assert set(codes) <= {201, 409}, codes
    assert codes[201] == len(seat_ids)
    booked = Counter(b.seat_id for b in active_bookings(pg_factory, cinema["session_id"]))
    assert booked == Counter(seat_ids)


def test_scenario_7_no_duplicates_after_mixed_load(pg_factory, cinema, make_users) -> None:
    """7. Смешанная нагрузка (30 пользователей, 5 «горячих» мест) — в БД нет дублей."""
    users = make_users(30)
    hot_seats = [cinema["seat"][(1, number)] for number in range(6, 11)]

    results = run_parallel(
        [
            partial(post_booking, u["token"], cinema["session_id"], hot_seats[i % 5])
            for i, u in enumerate(users)
        ]
    )

    assert Counter(code for code, _ in results) == {201: 5, 409: 25}
    assert_no_duplicate_active_bookings(pg_factory)


# --------------------------------------------------------------------------- 5.7: откат


def test_rollback_on_db_error_leaves_no_rows_and_db_usable(pg_factory, cinema, make_users) -> None:
    """5.7: сбой БД после INSERT, в момент COMMIT -> ROLLBACK.
    Частичной записи нет, блокировка FOR UPDATE снята, следующий запрос проходит."""
    [user] = make_users(1)
    seat_id = cinema["seat"][(3, 3)]

    def failing_get_db() -> Iterator[Session]:
        db = pg_factory()

        def commit() -> None:
            db.flush()  # INSERT уже выполнен внутри транзакции
            raise RuntimeError("Имитация сбоя БД при фиксации транзакции")

        db.commit = commit
        try:
            yield db
        finally:
            db.close()

    normal_get_db = app.dependency_overrides[get_db]
    app.dependency_overrides[get_db] = failing_get_db
    try:
        code, body = post_booking(user["token"], cinema["session_id"], seat_id)
    finally:
        app.dependency_overrides[get_db] = normal_get_db

    assert code == 500
    assert body == {"detail": "Ошибка при создании брони"}  # без трассировки (SEC-ERR-03)
    with pg_factory() as db:
        assert db.scalar(select(func.count()).select_from(Booking)) == 0
        # Блокировка снята: место можно заблокировать без ожидания
        db.execute(text("SET LOCAL lock_timeout = '1s'"))
        db.execute(select(Seat).where(Seat.id == seat_id).with_for_update())
        db.rollback()

    code, _ = post_booking(user["token"], cinema["session_id"], seat_id)
    assert code == 201


def test_unknown_session_returns_404(pg_factory, cinema, make_users) -> None:
    """5.7: бронь на несуществующий сеанс — 404, записей нет (исправление PR #20)."""
    [user] = make_users(1)
    code, body = post_booking(user["token"], uuid.uuid4(), cinema["seat"][(1, 1)])
    assert code == 404
    assert body == {"detail": "Сеанс не найден"}
    with pg_factory() as db:
        assert db.scalar(select(func.count()).select_from(Booking)) == 0


def test_seat_from_other_hall_is_rejected(pg_factory, cinema, make_users) -> None:
    """Место из другого зала не бронируется (исправление PR #20)."""
    [user] = make_users(1)
    code, body = post_booking(user["token"], cinema["session_id"], cinema["foreign_seat_id"])
    assert code == 400
    assert body == {"detail": "Это место находится в другом зале"}
    with pg_factory() as db:
        assert db.scalar(select(func.count()).select_from(Booking)) == 0


def test_unknown_seat_returns_404(cinema, make_users) -> None:
    [user] = make_users(1)
    code, body = post_booking(user["token"], cinema["session_id"], 999_999)
    assert code == 404
    assert body == {"detail": "Место не найдено"}


def test_booking_requires_token(cinema) -> None:
    with TestClient(app) as client:
        response = client.post(
            BOOKINGS_URL,
            json={"session_id": str(cinema["session_id"]), "seat_id": cinema["seat"][(1, 1)]},
        )
    assert response.status_code == 401
