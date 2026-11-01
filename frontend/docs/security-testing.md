# Как проводить проверки по чек-листу безопасности

WBS **3.4.2** · спринт 1 · [Frontend/QA] Скляров Антон
Чек-лист с результатами: `docs/requirements/security-checklist.md` (автор — [Аналитик/QA], 3.4.1).
Здесь — команды для каждой проверки, чтобы прогон можно было повторить.

## 1. Подготовка стенда (macOS)

```bash
brew install python@3.12 postgresql@16   # backend требует Python 3.11+
brew services start postgresql@16
createuser bileton --pwprompt            # пароль: bileton
createdb bileton -O bileton

cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                      # JWT_SECRET_KEY — любая длинная строка
alembic upgrade head
uvicorn app.main:app --reload             # оставить окно открытым: это и есть «логи сервера»
```

Во втором окне терминала:

```bash
API=http://127.0.0.1:8000/api
```

Фронтенд: `frontend/.env.local` → `VITE_USE_MOCKS=false`, затем `npm run dev`, открыть <http://localhost:5173>.

### Вспомогательные команды

Получить токен (поле `access_token` — уточнить по Swagger после мержа JWT-ветки):

```bash
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"qa1@test.ru","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo $TOKEN
```

Посмотреть payload токена локально (не вставлять токены на сторонние сайты):

```bash
python3 -c "import sys,base64,json; p=sys.argv[1].split('.')[1]; print(json.dumps(json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4))), indent=2, ensure_ascii=False))" "$TOKEN"
```

Запрос `/auth/me` с произвольным токеном:

```bash
curl -s -i $API/auth/me -H "Authorization: Bearer $T"
```

Посмотреть пользователей в БД:

```bash
psql -U bileton -d bileton -c "SELECT email, role, left(password_hash, 12) AS hash_start FROM users;"
```

## 2. Что можно проверить уже сейчас (эндпоинты отвечают 501)

FastAPI проверяет тело запроса **до** вызова обработчика, поэтому невалидные данные дают 422 уже сейчас.
Валидные данные пока дают 501 — такие проверки ждут JWT-ветку.

| ID | Команда / действие |
|---|---|
| SEC-AUTH-05 | `curl -s -i -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"email":"qa@test.ru","password":"1234567","password_confirm":"1234567","full_name":"QA"}'` → ждём 422 |
| SEC-AUTH-07 | Открыть `/register`, ввести пароль: точки вместо символов. DevTools → Elements: `type="password"` у обоих полей |
| SEC-AUTH-08 | То же, что AUTH-05, но `"password":"password123","password_confirm":"password124"` → 422 «Пароли не совпадают» |
| SEC-IN-01 | Тело регистрации с `"email":"user@"`, `"email":"user"`, `"email":""` → 422 |
| SEC-IN-02 (email) | `"email":"' OR 1=1 --"` в регистрации → 422; в ответе нет текста ошибок SQL |
| SEC-IN-04 | `full_name` из 256 символов, пароль из 129 символов, email длиннее 255 → 422 |
| SEC-IN-05 | Пустые и пробельные значения: `"email":"   "`, `"password":"        "` (8 пробелов), без `full_name` |
| SEC-JWT-07 | Решение описано в `frontend/README.md`, раздел «Хранение токена» |
| SEC-TR-02 | `git ls-files \| grep -i env` → только `backend/.env.example` и `alembic/env.py`; `.env` есть в `.gitignore`; `git log --all -- backend/.env` пуст |
| SEC-TR-03 | `curl -s -i -X OPTIONS $API/auth/login -H 'Origin: http://evil.example' -H 'Access-Control-Request-Method: POST'` → 400, нет `access-control-allow-origin`; с `Origin: http://localhost:5173` → 200 и заголовок есть |
| SEC-TR-04 | `curl -s -I http://127.0.0.1:8000/api/health` → есть ли `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` |

Для генерации длинных строк: `python3 -c "print('a'*256)"`.

## 3. После мержа JWT-ветки Lead Dev

Сначала зарегистрировать двух пользователей: `qa1@test.ru` / `password123` (viewer)
и назначить контроллера вручную в БД:
`psql -U bileton -d bileton -c "UPDATE users SET role='controller' WHERE email='qa2@test.ru';"`.

| ID | Команда / действие |
|---|---|
| SEC-AUTH-01 | Регистрация → `psql` (см. выше): хеш начинается с `$argon2id$` или `$2b$`, открытого пароля нет |
| SEC-AUTH-02 | Регистрация и вход через UI, затем просмотреть окно `uvicorn` и вывод `grep -r "password123" backend/logs 2>/dev/null` |
| SEC-AUTH-03 | `curl -s` регистрации, входа (в т. ч. ошибочных) и `/auth/me`: в JSON нет `password` / `password_hash` |
| SEC-AUTH-04 | DevTools → Network: в URL запросов `register`/`login` нет пароля, он только во вкладке Payload |
| SEC-AUTH-06 | Регистрация с `"password":"aaaaaaaa","password_confirm":"aaaaaaaa"` → 201 |
| SEC-JWT-01 | Вход с неверным паролем и с `nobody@test.ru` → 401, в ответе нет токена |
| SEC-JWT-02 | Декодировать `$TOKEN` (см. выше): есть `sub`, `role`, `exp`; нет пароля |
| SEC-JWT-03 | `T="${TOKEN%?}x"` (заменили последний символ подписи) → `/auth/me` → 401 |
| SEC-JWT-04 | Токен с `alg=none` — команда ниже → 401 |
| SEC-JWT-05 | В `backend/.env` `ACCESS_TOKEN_EXPIRE_MINUTES=1`, перезапустить backend, войти, подождать 2 минуты → `/auth/me` → 401. Вернуть значение обратно |
| SEC-JWT-06 | DevTools → Network: токен только в заголовке `Authorization`; адресная строка и окно `uvicorn` без токена |
| SEC-JWT-08 | Сохранить `$TOKEN`, нажать «Выйти» в UI, затем `/auth/me` со старым токеном → 200 (ожидаемо: серверного отзыва нет) |
| SEC-ROLE-01 | `curl -s -i $API/auth/me` без заголовка → 401; в UI без токена `/profile` → редирект на вход |
| SEC-ROLE-02 | `T=abc` → `/auth/me` → 401 |
| SEC-ROLE-05 | Токен с подменённой ролью — команда ниже → 401 |
| SEC-ROLE-07 | Регистрация с лишним полем `"role":"controller"` → 201, в ответе и в БД `viewer` |
| SEC-IN-02 (пароль) | Вход с `"password":"' OR 1=1 --"` → 401 (это валидная строка пароля, до SQL как параметр) |
| SEC-IN-03 | Регистрация через UI с именем `<script>alert(1)</script>`, вход → в профиле имя выводится текстом, окна alert нет |
| SEC-ERR-01, 02 | Сравнить тело и код ответа входа для неверного пароля и несуществующего email — совпадают, 401 |
| SEC-ERR-03 | `brew services stop postgresql@16`, повторить вход → 500 с общим сообщением, без трассировки; трассировка только в окне `uvicorn`. Затем `brew services start postgresql@16` |
| SEC-ERR-04 | Сравнить тела 401, 409, 422 |
| SEC-ERR-05 | Повторная регистрация того же email → 409 |
| SEC-BR-01 | `for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}\n" -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"qa1@test.ru","password":"wrong-pass"}'; done` → есть ли 429 |
| SEC-BR-02 | То же для регистрации: `-d "{\"email\":\"bulk$i@test.ru\",\"password\":\"password123\",\"password_confirm\":\"password123\"}"` |
| SEC-BR-03 | `curl -s -o /dev/null -w "%{time_total}\n" …` по 5 раз для существующего и несуществующего email, сравнить среднее |
| SEC-SESS-01 | Войти, «Выйти», открыть `/profile` → редирект на вход, ключа `bileton_access_token` нет |
| SEC-SESS-02 | Войти, «Выйти», нажать «Назад» → профиль не отображается |
| SEC-SESS-03 | Как SEC-JWT-05, но в UI: дождаться истечения и обновить `/profile` → редирект на вход, токен удалён |

Подделанные токены для SEC-JWT-04 и SEC-ROLE-05:

```bash
# alg=none, подписи нет
T=$(python3 -c "
import sys,base64,json
b=lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b'=').decode()
p=sys.argv[1].split('.')[1]; payload=json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))
print(b({'alg':'none','typ':'JWT'})+'.'+b(payload)+'.')" "$TOKEN")
curl -s -i $API/auth/me -H "Authorization: Bearer $T"

# role подменена на controller, подпись старая
T=$(python3 -c "
import sys,base64,json
h,p,s=sys.argv[1].split('.'); payload=json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4)))
payload['role']='controller'
print(h+'.'+base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()+'.'+s)" "$TOKEN")
curl -s -i $API/auth/me -H "Authorization: Bearer $T"
```

## 4. Как записывать результат

- **Статус** — только значения из чек-листа: `Pass`, `Fail`, `Не проверено`, `Отложено (спринт 4)`, `Не применимо`.
- **Комментарий** — при `Fail` и любом отклонении: что получили фактически (код, текст), номер issue.
  Существующий комментарий автора не стирать, а дописывать через ` · `.
- На каждый `Fail` — issue по шаблону «Bug report» с ID проверки в заголовке, например
  `[SEC-IN-05] backend принимает пароль из 8 пробелов`.
