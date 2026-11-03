# Backend «БилетON»

REST API на FastAPI + SQLAlchemy + PostgreSQL.

## Структура

```
backend/
├── app/
│   ├── api/          # роутеры (health, auth)
│   ├── core/         # настройки, безопасность (JWT — TODO Lead Dev)
│   ├── db/           # Base и сессия SQLAlchemy
│   ├── models/       # ORM-модели (users)
│   ├── schemas/      # Pydantic-схемы
│   ├── services/     # бизнес-логика (auth — TODO Lead Dev)
│   └── main.py       # точка входа
├── alembic/          # миграции
├── tests/            # pytest
├── requirements.txt
└── .env.example
```

## Быстрый старт (Windows / PowerShell)

```powershell
cd backend

# 1. Виртуальное окружение (в PyCharm уже создано: backend\venv)
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Зависимости
pip install -r requirements.txt

# 3. Настройки
Copy-Item .env.example .env
# отредактируйте .env: DATABASE_URL и JWT_SECRET_KEY

# 4. База данных (в pgAdmin или psql)
#    CREATE USER bileton WITH PASSWORD 'bileton';
#    CREATE DATABASE bileton OWNER bileton;

# 5. Миграции
alembic upgrade head

# 6. Запуск
uvicorn app.main:app --reload
```

Swagger: <http://127.0.0.1:8000/docs>

## Тесты и линтер

```powershell
pytest
ruff check .
```

## Статус спринта 1

- [x] каркас приложения, таблица `users`, миграция, тесты — [PM/Backend] (3.2.1)
- [x] CI и шаблоны PR/issue — [PM/Backend] (2.1.1, 2.2.1)
- [ ] JWT, роли, эндпоинты `/auth/*` — [Lead Dev] (3.2.2)
- [ ] дополнить инструкцию по локальному запуску — [Lead Dev] (2.1.2)
