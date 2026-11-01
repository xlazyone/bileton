# Frontend «БилетON»

SPA на React + Vite: страницы входа и регистрации, интеграция с API авторизации.

## Структура

```
frontend/
├── docs/
│   └── qa-checklist.md   # чек-лист ручной проверки форм (3.4.2)
├── public/               # статика без обработки (favicon)
├── src/
│   ├── api/              # запросы к backend: client (fetch, ошибки), auth, mockServer (моки, пока API 501)
│   ├── components/       # общие компоненты: Layout, AuthLayout, FormField, Alert, ProtectedRoute
│   ├── context/          # AuthProvider — текущий пользователь, вход/выход
│   ├── hooks/            # useAuth, useForm
│   ├── pages/            # страницы: Login, Register, Profile, Controller, NotFound
│   ├── styles/           # глобальные стили (index.css)
│   ├── utils/            # validation (правила как на backend), tokenStorage, roles
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
| `/` | редирект: в свой раздел или на вход | все |
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

Ручная проверка — [`docs/qa-checklist.md`](docs/qa-checklist.md),
проверки безопасности — [`../docs/requirements/security-checklist.md`](../docs/requirements/security-checklist.md).

## Статус спринта 1

- [x] вёрстка страниц входа и регистрации, клиентская валидация — [Frontend] (3.3.1)
- [x] интеграция форм с API на мок-ответах, сохранение токена, выход — [Frontend] (3.3.2)
- [ ] переключение на реальный API после мержа JWT-ветки — [Frontend] (3.3.2)
- [x] чек-лист ручной проверки и автотесты — [Frontend/QA] (3.4.2)
- [ ] прогон чек-листа на реальном API, заведение багов — [Frontend/QA] (3.4.2)
- [ ] сверка с макетом Figma — [Frontend] (3.3.1)
