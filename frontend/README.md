# Frontend «БилетON»

SPA на React + Vite.

- **Спринт 1:** страницы входа и регистрации, интеграция с API авторизации.
- **Спринт 2:** афиша, расписание сеансов, переход к выбору мест (US-01…US-06).
- **Спринт 3:** интерактивная схема зала и бронирование места с обработкой 409 (WBS 5.4, 5.5, 5.7).

## Структура

```
frontend/
├── docs/
│   ├── qa-checklist.md   # чек-лист ручной проверки форм (спринт 1, 3.4.2)
│   ├── qa-sprint2.md     # тест-кейсы пустого расписания (4.6) и проверка вёрстки (4.7)
│   ├── qa-sprint3.md     # прогон сценариев бронирования и нагрузочного теста (5.6, 5.7)
│   └── security-testing.md
├── public/               # статика без обработки (favicon)
├── src/
│   ├── api/              # запросы к backend: client (fetch, ошибки), auth, movies, booking;
│   │                     #   моки: mockServer (авторизация), mockCinema (афиша и сеансы)
│   ├── components/       # Layout, AuthLayout, FormField, Alert, ProtectedRoute,
│   │                     #   MovieCard, Poster, PageState (загрузка / ошибка / пусто),
│   │                     #   SeatMap (схема зала на CSS Grid)
│   ├── context/          # AuthProvider — текущий пользователь, вход/выход
│   ├── hooks/            # useAuth, useForm, useAsync (загрузка данных с «Повторить»)
│   ├── pages/            # Login, Register, Profile, Controller, NotFound,
│   │                     #   Movies (афиша), Schedule (расписание), SeatSelection (схема зала и бронь)
│   ├── styles/           # глобальные стили (index.css)
│   ├── utils/            # validation, tokenStorage, roles (куда вести после входа),
│   │                     #   movies (нормализация и форматы), schedule (группировка по дням),
│   │                     #   seatMap (схема зала: нормализация, сетка рядов)
│   ├── App.jsx           # маршруты
│   ├── config.js         # VITE_API_URL, VITE_USE_MOCKS, VITE_MOCK_CINEMA
│   └── main.jsx          # точка входа
├── tests/                # Vitest + Testing Library
├── index.html
├── vite.config.js        # dev-сервер на localhost:5173, настройки тестов
├── .oxlintrc.json       # настройки линтера oxlint
├── package.json
└── .env.example
```

## Маршруты

| Путь | Страница | Доступ |
|---|---|---|
| `/` | Афиша (US-01) | все, без входа |
| `/movies/:movieId` | Расписание фильма (US-02…US-04) | все, без входа |
| `/sessions/:sessionId/seats` | Схема зала и бронирование места (5.4, 5.5) | авторизованные; гость → вход и обратно (US-05) |
| `/register` | Регистрация (UC-01) | гость |
| `/login` | Вход (UC-02) | гость |
| `/profile` | Личный кабинет | viewer, controller |
| `/controller` | Панель контроллера (заглушка) | controller |

## Быстрый старт

Нужен Node.js LTS — 22.x (`node -v`), установщик: <https://nodejs.org>.

### Windows (PowerShell)

```powershell
cd frontend

# 1. Зависимости
npm install

# 2. Настройки
Copy-Item .env.example .env.local
# по умолчанию — реальный backend на http://127.0.0.1:8000 (см. «Запуск с backend»)

# 3. Запуск
npm run dev
```

Если PowerShell пишет «выполнение сценариев отключено» при запуске `npm`, один раз выполните
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` или используйте `npm.cmd` вместо `npm`.

### macOS / Linux

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Откройте <http://localhost:5173> — именно `localhost`, не `127.0.0.1`: в CORS backend разрешён только `http://localhost:5173`.

## Запуск с backend (спринт 3)

С спринта 3 фронтенд по умолчанию работает **только с реальным API**: схема зала и бронирование
моков не имеют. Нужны PostgreSQL, применённые миграции и данные каталога.

```bash
# 1. Backend (окно 1) — подробно в backend/README.md
cd backend
source venv/bin/activate          # Windows: .\venv\Scripts\Activate.ps1
alembic upgrade head
python -m scripts.seed_demo       # залы с местами, фильмы, сеансы; --reset — пересоздать
uvicorn app.main:app --reload

# 2. Frontend (окно 2)
cd frontend
cp .env.example .env.local        # VITE_USE_MOCKS=false, VITE_MOCK_CINEMA=false
npm run dev
```

Аккаунт создаётся через `/register`. Фильм без сеансов для US-04 — «Тихая гавань».

### Демо-режим без backend (необязательно)

Моки спринтов 1–2 остались для показа без backend. Включаются в `frontend/.env.local`:

| `VITE_USE_MOCKS` | `VITE_MOCK_CINEMA` | Авторизация | Афиша | Схема зала | Плашка |
|---|---|---|---|---|---|
| `false` | `false` | реальный API | реальный API | реальный API | нет |
| `false` | `true` | реальный API | моки | реальный API* | «Демо-афиша» |
| `true` | любое | моки | моки | недоступна | «Демо-режим» |

\* id сеансов в моках не совпадают с backend, поэтому схема зала из мок-афиши ответит «Сеанс не найден».
После изменения `.env.local` перезапустите `npm run dev`.

Мок-аккаунты (пароль `password123`): `viewer@bileton.ru`, `controller@bileton.ru`.
Сценарии мок-афиши: `/?mock=empty`, `/?mock=error`, `/?mock=slow`; фильм без сеансов — `/movies/6`.

Автотесты (`npm test`) от `.env.local` не зависят: `vite.config.js` всегда включает моки
авторизации и афиши, а запросы схемы зала и брони подменяются в самих тестах.

## Хранение токена (SEC-JWT-07)

Принятый вариант для MVP: JWT хранится в `localStorage` под ключом `bileton_access_token`
(`src/utils/tokenStorage.js`) и передаётся только в заголовке `Authorization: Bearer <token>`.
Cookie не используются (SEC-TR-05).

- **Почему так:** сессия переживает перезагрузку страницы; не нужны cookie, CSRF-защита и настройка `SameSite` на backend.
- **Риск:** токен доступен любому JavaScript на странице, поэтому XSS-уязвимость позволит его украсть.
- **Как снижаем риск:** React экранирует выводимые данные (SEC-IN-03), `dangerouslySetInnerHTML` в проекте не используется,
  токен не попадает в URL и логи (SEC-JWT-06), срок жизни ограничен `ACCESS_TOKEN_EXPIRE_MINUTES`.
- **Выход:** токен удаляется на клиенте; серверного отзыва нет, токен действует до `exp` (SEC-JWT-08).
- **401 на любом запросе с токеном:** токен удаляется, пользователь отправляется на вход (`handleUnauthorized` в `src/api/client.js`).
- **Если понадобится строже:** перейти на httpOnly-cookie — это изменение backend и фронтенда, вне MVP.

## Контракт API (спринт 1)

| Запрос | Тело | Ответ |
|---|---|---|
| `POST /api/auth/register` | `{email, password, password_confirm, full_name}` | 201 + `{id, email, full_name, role, is_active, created_at}`; 409 — email занят; 422 — валидация |
| `POST /api/auth/login` | `{email, password}` | токен |
| `GET /api/auth/me` | заголовок `Authorization: Bearer <token>` | 200 + профиль; 401 — нет/просрочен токен |

## Контракт API (спринт 2) — афиша и сеансы

Реализован Lead Dev в задаче 4.3 по этому описанию. Публичные, без токена.

`GET /api/movies` → `200`, массив (пустой массив — афиша пуста):

```json
[
  {
    "id": 1,
    "title": "Северное сияние",
    "genres": ["драма", "приключения"],
    "duration_minutes": 128,
    "age_rating": "12+",
    "poster_url": "https://…/poster.jpg"
  }
]
```

`GET /api/sessions?movie_id=1` → `200`, массив (пустой массив — сеансов нет, **не ошибка**, US-04):

```json
[
  {
    "id": 101,
    "movie_id": 1,
    "starts_at": "2026-11-10T19:40:00+03:00",
    "hall": { "id": 1, "name": "Зал 1" },
    "price": 450
  }
]
```

- `starts_at` — ISO 8601 **с часовым поясом**; группировка по дням идёт по местному времени браузера.
- Зал и цена — в самом сеансе (US-03: без дополнительных запросов).
- Отдельного `GET /movies/{id}` в WBS нет: страница расписания берёт фильм из `GET /movies`.

Если имена полей на backend будут другими, менять только нормализаторы в `src/utils/movies.js` —
они уже понимают `genres` строкой или списком `{name}`, `duration`/`duration_min`, `hall_name`/`hall_number`,
цену строкой (`"450.00"`) и ответ вида `{"items": [...]}`.

## Контракт API (спринт 3) — схема зала и бронирование

`GET /api/sessions/{session_id}/seats` — публичный, `200` или `404 {"detail": "Сеанс не найден"}`.
Фронтенд прикладывает токен (если пользователь вошёл), чтобы получить свои брони как `mine`:

```json
{
  "session_id": "4e424234-…",
  "starts_at": "2026-11-19T21:30:00+03:00",
  "price": 450.0,
  "movie": { "id": "d69d0bcd-…", "title": "Код доступа", "age_rating": "16+" },
  "hall": { "id": 8, "name": "Зал 2", "rows_count": 6, "seats_per_row": 10 },
  "seats": [ { "id": 457, "row": 1, "number": 1, "status": "free" } ]
}
```

`status`:

| Значение | Когда | На схеме |
|---|---|---|
| `free` | нет активной брони (или `reserved` просрочена) | свободно, можно выбрать |
| `occupied` | чужая бронь `paid` или `reserved` с `expires_at` в будущем; любая бронь, если запрос без токена | занято |
| `mine` | бронь текущего пользователя; приходит с `expires_at` (у оплаченной его нет) | «ваша бронь», блок «Ваши брони на этот сеанс» |

Битый или просроченный токен не даёт `401`: схема возвращается как гостю.

`POST /api/bookings` + `Authorization: Bearer <token>`, тело `{"session_id": "…", "seat_id": 457}`:

| Ответ | Что делает фронтенд |
|---|---|
| `201` `{id, session_id, seat_id, status: "reserved", created_at, expires_at}` | «Место забронировано… Бронь действует до HH:MM», место — «ваша бронь», схема перезапрашивается; можно забронировать ещё место (5.1, разделы 1 и 6) |
| `409` `{"detail": {"code": "SEAT_ALREADY_BOOKED", "message", "session_id", "seat_id"}}` | сообщение сервера + «Выберите другое место», место помечается занятым, выбор снимается, схема перезапрашивается |
| `401` | токен удаляется, переход на вход и возврат на ту же схему после входа |
| `404`, `5xx`, сеть | сообщение, выбранное место сохраняется для повтора |

Повторный запрос того же пользователя на то же место возвращает ту же бронь (двойной клик безопасен);
кнопка «Забронировать» дополнительно блокируется на время запроса.

## Валидация форм (спринт 1)

Клиентская валидация (`src/utils/validation.js`) повторяет `UserCreate` из `backend/app/schemas/user.py`:
email по формату, пароль 8–128 символов, пароли совпадают, имя до 255 символов.

## Тесты и линтер

```bash
npm test        # Vitest: валидация, мок-сервер, сценарии UC-01…UC-04, контракт с API
npm run lint    # oxlint
npm run build   # production-сборка в dist/
```

| Файл | Что проверяет |
|---|---|
| `tests/validation.test.js` | правила клиентской валидации (совпадают с `UserCreate` на backend) |
| `tests/api.test.js` | мок-сервер повторяет контракт API, разбор ошибок FastAPI |
| `tests/contract.test.js` | запросы к настоящему API: URL, тела, заголовок `Authorization`, реакция на 201/401/409/422/500 и обрыв сети |
| `tests/authPages.test.jsx` | сценарии UC-01…UC-04 через интерфейс |
| `tests/movies.test.js` | нормализация ответов `/movies`, `/sessions`; форматы длительности и цены |
| `tests/schedule.test.js` | группировка по дням, сортировка, прошедшие сеансы, пустое расписание |
| `tests/moviesContract.test.js` | запросы к настоящему API афиши: URL, `movie_id`, без токена, `200 []` — не ошибка |
| `tests/moviesPages.test.jsx` | сценарии US-01…US-05 через интерфейс, тест-кейсы 4.6 |
| `tests/seatMap.test.js` | схема зала: нормализация ответа, раскладка по рядам, пропуски мест |
| `tests/bookingContract.test.js` | запросы схемы зала и брони: URL, тело, токен, разбор 409 `SEAT_ALREADY_BOOKED`, 401 |
| `tests/seatSelection.test.jsx` | страница выбора мест: занятые не кликабельны, один выбор, 201, 409, сеть, двойной клик |

Ручная проверка — [`docs/qa-checklist.md`](docs/qa-checklist.md) (спринт 1), [`docs/qa-sprint2.md`](docs/qa-sprint2.md) (спринт 2),
[`docs/qa-sprint3.md`](docs/qa-sprint3.md) (спринт 3, вместе с нагрузочным тестом backend),
проверки безопасности — [`../docs/requirements/security-checklist.md`](../docs/requirements/security-checklist.md).

## Статус спринта 1

- [x] вёрстка страниц входа и регистрации, клиентская валидация — [Frontend] (3.3.1)
- [x] интеграция форм с API на мок-ответах, сохранение токена, выход — [Frontend] (3.3.2)
- [x] переключение на реальный API после мержа JWT-ветки — [Frontend] (3.3.2)
- [x] чек-лист ручной проверки и автотесты — [Frontend/QA] (3.4.2)
- [x] прогон чек-листа на реальном API, заведение багов — [Frontend/QA] (3.4.2)
- [x] сверка с макетом Figma — [Frontend] (3.3.1)

## Статус спринта 2

- [x] вёрстка карточек фильмов и страницы выбора сеанса, адаптив — [Frontend] (4.4)
- [x] подключение API афиши на мок-ответах, состояния загрузки / ошибки / пусто — [Frontend] (4.5)
- [x] переключение на реальные `GET /movies`, `GET /sessions` после мержа 4.3 — [Frontend] (4.5, спринт 3)
- [x] тест-кейсы пустого расписания и автотесты — [Аналитик/QA] (4.6)
- [x] прогон `docs/qa-sprint2.md` на моках и на реальном API — [Frontend/QA] (4.7)

## Статус спринта 3

- [x] вёрстка интерактивной схемы зала на CSS Grid, статусы свободно / занято / выбрано — [Frontend] (5.4)
- [x] интеграция с `POST /bookings`, обработка 409 — [Frontend] (5.5)
- [x] нагрузочный тест бронирования `backend/tests/test_booking_concurrency.py` — [Аналитик/QA] (5.6)
- [x] сценарии 5.7 и проверка отката транзакции в автотестах — [Frontend/QA] (5.7)
- [x] ручной прогон `docs/qa-sprint3.md` на стенде — [Frontend/QA] (5.7)
