# Frontend «БилетON»

SPA на React + Vite.

- **Спринт 1:** страницы входа и регистрации, интеграция с API авторизации.
- **Спринт 2:** афиша, расписание сеансов, переход к выбору мест (US-01…US-06).

## Структура

```
frontend/
├── docs/
│   ├── qa-checklist.md   # чек-лист ручной проверки форм (спринт 1, 3.4.2)
│   ├── qa-sprint2.md     # тест-кейсы пустого расписания (4.6) и проверка вёрстки (4.7)
│   └── security-testing.md
├── public/               # статика без обработки (favicon)
├── src/
│   ├── api/              # запросы к backend: client (fetch, ошибки), auth, movies;
│   │                     #   моки: mockServer (авторизация), mockCinema (афиша и сеансы)
│   ├── components/       # Layout, AuthLayout, FormField, Alert, ProtectedRoute,
│   │                     #   MovieCard, Poster, PageState (загрузка / ошибка / пусто)
│   ├── context/          # AuthProvider — текущий пользователь, вход/выход
│   ├── hooks/            # useAuth, useForm, useAsync (загрузка данных с «Повторить»)
│   ├── pages/            # Login, Register, Profile, Controller, NotFound,
│   │                     #   Movies (афиша), Schedule (расписание), SeatSelection (вход в бронирование)
│   ├── styles/           # глобальные стили (index.css)
│   ├── utils/            # validation, tokenStorage, roles (куда вести после входа),
│   │                     #   movies (нормализация и форматы), schedule (группировка по дням)
│   ├── App.jsx           # маршруты
│   ├── config.js         # VITE_API_URL, VITE_USE_MOCKS
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
| `/sessions/:sessionId/seats` | Выбор мест — вход в модуль бронирования 5.0 (US-05); пока заглушка | авторизованные; гость → вход и обратно |
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
# по умолчанию VITE_USE_MOCKS=true — работаем без backend

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

## Моки и реальный API

Пока эндпоинты `/api/auth/*` отвечают **501**, запросы обрабатывает `src/api/mockServer.js`
(в шапке видна плашка «Демо-режим»). Мок повторяет контракт: 201 / 409 / 422 при регистрации,
401 при неверном входе и невалидном токене.

Тестовые аккаунты на моках (пароль `password123`):

| Email | Роль |
|---|---|
| `viewer@bileton.ru` | viewer |
| `controller@bileton.ru` | controller |

После мержа JWT-ветки Lead Dev в `dev`:

1. Запустить backend (`backend/README.md`, Swagger — <http://127.0.0.1:8000/docs>).
2. В `frontend/.env.local` поставить `VITE_USE_MOCKS=false` (файл открывается в любом редакторе, в том числе в PyCharm).
3. Перезапустить `npm run dev` (Vite читает `.env.local` только при старте; остановка — <kbd>Ctrl</kbd>+<kbd>C</kbd>).
4. Сверить в Swagger схему ответа `POST /api/auth/login`. Фронтенд ожидает `{"access_token": "..."}`
   или `{"token": "..."}` — если поле называется иначе, поправить `extractToken` в `src/api/auth.js`.

### Моки афиши (спринт 2)

`GET /movies` и `GET /sessions` появятся после задачи 4.3 (Lead Dev). До этого афиша работает
на `src/api/mockCinema.js` — даже если авторизация уже на реальном API (`VITE_USE_MOCKS=false`).
Переключатель — `VITE_MOCK_CINEMA` в `frontend/.env.local`:

| `VITE_USE_MOCKS` | `VITE_MOCK_CINEMA` | Авторизация | Афиша | Плашка в шапке |
|---|---|---|---|---|
| `true` | любое | моки | моки | «Демо-режим» |
| `false` | `true` или не задано | реальный API | моки | «Демо-афиша» |
| `false` | `false` | реальный API | реальный API | нет |

Сеансы в моках строятся от текущей даты. Для ручной проверки:

| Что | Где |
|---|---|
| фильм без сеансов (US-04) | «Тихая гавань», `/movies/6` |
| только будущие сеансы | «Последний рейс», `/movies/4` |
| вчерашний сеанс скрыт | «Тайна старого маяка», `/movies/5` |
| пустая афиша | `/?mock=empty` |
| ошибка сети и «Повторить» | `/?mock=error` |
| долгая загрузка | `/?mock=slow` |

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

## Контракт API (спринт 2) — ожидания фронтенда

Эндпоинты ещё делает Lead Dev (4.3). Ниже — формат, под который написан фронтенд;
**согласовать с Lead Dev до мержа 4.3**. Публичные, без токена.

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

Ручная проверка — [`docs/qa-checklist.md`](docs/qa-checklist.md) (спринт 1), [`docs/qa-sprint2.md`](docs/qa-sprint2.md) (спринт 2),
проверки безопасности — [`../docs/requirements/security-checklist.md`](../docs/requirements/security-checklist.md).

## Статус спринта 1

- [x] вёрстка страниц входа и регистрации, клиентская валидация — [Frontend] (3.3.1)
- [x] интеграция форм с API на мок-ответах, сохранение токена, выход — [Frontend] (3.3.2)
- [ ] переключение на реальный API после мержа JWT-ветки — [Frontend] (3.3.2)
- [x] чек-лист ручной проверки и автотесты — [Frontend/QA] (3.4.2)
- [ ] прогон чек-листа на реальном API, заведение багов — [Frontend/QA] (3.4.2)
- [ ] сверка с макетом Figma — [Frontend] (3.3.1)

## Статус спринта 2

- [x] вёрстка карточек фильмов и страницы выбора сеанса, адаптив — [Frontend] (4.4)
- [x] подключение API афиши на мок-ответах, состояния загрузки / ошибки / пусто — [Frontend] (4.5)
- [ ] переключение на реальные `GET /movies`, `GET /sessions` после мержа 4.3 — [Frontend] (4.5)
- [x] тест-кейсы пустого расписания и автотесты — [Аналитик/QA] (4.6)
- [ ] прогон `docs/qa-sprint2.md` на моках и на реальном API — [Frontend/QA] (4.7)
