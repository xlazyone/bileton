"""Демо-данные для ручной проверки фронтенда на реальном API (WBS 5.7).

Создаёт залы с местами, фильмы и сеансы на ближайшие дни (от текущей даты),
плюс фильм без сеансов — для проверки пустого расписания (US-04).

Запуск из папки backend/ (база — DATABASE_URL из backend/.env, миграции применены):

    python -m scripts.seed_demo            # добавить, если каталог пуст
    python -m scripts.seed_demo --reset    # удалить брони, сеансы, фильмы, места, залы
                                           # и создать заново

Пользователей скрипт не трогает.
"""

import argparse
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.hall import Hall
from app.models.movie import Movie
from app.models.seat import Seat
from app.models.session import Session as MovieSession

HALLS = [("Зал 1", 8, 12), ("Зал 2", 6, 10), ("Зал 3 · VIP", 4, 6)]

MOVIES = [
    ("Северное сияние", ["драма", "приключения"], 128, "12+"),
    ("Код доступа", ["триллер", "фантастика"], 114, "16+"),
    ("Лето в Звёздочке", ["семейный", "комедия"], 96, "6+"),
    ("Последний рейс", ["боевик"], 141, "18+"),
    ("Тайна старого маяка", ["детектив", "мистика"], 107, "12+"),
    ("Тихая гавань", ["мелодрама"], 102, "16+"),  # без сеансов — US-04
]

# (индекс фильма, смещение в днях, часы, минуты, индекс зала, цена)
PLAN = [
    (0, 0, 19, 40, 0, 450), (0, 0, 22, 10, 2, 650), (0, 1, 11, 0, 0, 300), (0, 1, 18, 20, 1, 450),
    (1, 0, 21, 30, 1, 450), (1, 1, 16, 45, 0, 400), (1, 2, 19, 0, 2, 600),
    (2, 1, 10, 30, 0, 250), (2, 1, 14, 10, 1, 300), (2, 3, 11, 20, 0, 250),
    (3, 1, 20, 30, 1, 450), (3, 1, 23, 0, 1, 450), (3, 2, 21, 45, 2, 650),
    (4, 0, 23, 30, 0, 400), (4, 2, 18, 0, 1, 400),
]  # fmt: skip


def reset(db: Session) -> None:
    for model in (Booking, MovieSession, Movie, Seat, Hall):
        db.execute(delete(model))
    db.commit()


def seed(db: Session) -> None:
    halls = [
        Hall(name=name, rows_count=rows, seats_per_row=per_row) for name, rows, per_row in HALLS
    ]
    movies = [
        Movie(title=title, genres=genres, duration_minutes=minutes, age_rating=rating)
        for title, genres, minutes, rating in MOVIES
    ]
    db.add_all([*halls, *movies])
    db.flush()

    db.add_all(
        Seat(hall_id=hall.id, row_number=row, seat_number=number)
        for hall in halls
        for row in range(1, hall.rows_count + 1)
        for number in range(1, hall.seats_per_row + 1)
    )

    today = datetime.now().astimezone().replace(hour=0, minute=0, second=0, microsecond=0)
    now = datetime.now().astimezone()
    for movie_index, day, hours, minutes, hall_index, price in PLAN:
        starts_at = today + timedelta(days=day, hours=hours, minutes=minutes)
        if starts_at <= now:
            starts_at += timedelta(days=1)  # прошедшее время сегодня — переносим на завтра
        db.add(
            MovieSession(
                movie_id=movies[movie_index].id,
                hall_id=halls[hall_index].id,
                starts_at=starts_at,
                price=price,
            )
        )
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="пересоздать каталог")
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.reset:
            reset(db)
        if db.scalar(select(func.count()).select_from(Movie)):
            print("Каталог уже заполнен — ничего не делаю (используйте --reset).")
            return
        seed(db)
        print(
            f"Готово: {len(HALLS)} зала, {len(MOVIES)} фильмов, {len(PLAN)} сеансов. "
            "Фильм без сеансов — «Тихая гавань»."
        )


if __name__ == "__main__":
    main()
