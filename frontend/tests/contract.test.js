// Контракт фронтенда с настоящим backend (WBS 3.3.2 / 3.4.2).
// fetch подменяется, а ответы — реальные ответы API спринта 1 (сняты с backend после мержа JWT).
// Тесты проверяют, что фронтенд шлёт правильные запросы и правильно понимает ответы.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractToken, realApi, toLoginPayload, toRegisterPayload } from '../src/api/auth'
import { NETWORK_ERROR_MESSAGE, UNAUTHORIZED_EVENT } from '../src/api/client'
import { API_URL } from '../src/config'

const TOKEN_KEY = 'bileton_access_token'

const RESPONSES = {
  register201: {
    email: 'anton@test.ru',
    full_name: 'Антон',
    id: 'dd754496-9850-4836-8212-cea6fd4f11a2',
    role: 'viewer',
    is_active: true,
    created_at: '2026-11-01T17:24:10',
  },
  register409: { detail: 'Пользователь с таким email уже существует' },
  register422Mismatch: {
    detail: [
      {
        type: 'value_error',
        loc: ['body'],
        msg: 'Value error, Пароли не совпадают',
        input: {},
        ctx: { error: {} },
      },
    ],
  },
  register422Email: {
    detail: [
      {
        type: 'value_error',
        loc: ['body', 'email'],
        msg: 'value is not a valid email address: There must be something after the @-sign.',
        input: 'user@',
      },
    ],
  },
  login200: { access_token: 'header.payload.signature', token_type: 'bearer', role: 'viewer' },
  login401: { detail: 'Неверный email или пароль' },
  me401: { detail: 'Невалидный или просроченный токен' },
}

let fetchMock

function respondWith(status, body) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

function lastRequest() {
  const [url, options] = fetchMock.mock.calls.at(-1)
  return { url, options, body: options.body ? JSON.parse(options.body) : undefined }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('тела запросов', () => {
  it('регистрация: snake_case-поля, email и имя без пробелов по краям, пароль как есть', () => {
    expect(
      toRegisterPayload({
        fullName: '  Антон ',
        email: ' anton@test.ru ',
        password: ' pass word ',
        passwordConfirm: ' pass word ',
      }),
    ).toEqual({
      email: 'anton@test.ru',
      password: ' pass word ',
      password_confirm: ' pass word ',
      full_name: 'Антон',
    })
  })

  it('вход: только email и password', () => {
    expect(toLoginPayload({ email: ' anton@test.ru ', password: 'password123' })).toEqual({
      email: 'anton@test.ru',
      password: 'password123',
    })
  })
})

describe('POST /api/auth/register', () => {
  const payload = toRegisterPayload({
    fullName: 'Антон',
    email: 'anton@test.ru',
    password: 'password123',
    passwordConfirm: 'password123',
  })

  it('201: запрос по контракту, ответ — профиль', async () => {
    respondWith(201, RESPONSES.register201)

    await expect(realApi.register(payload)).resolves.toEqual(RESPONSES.register201)

    const { url, options, body } = lastRequest()
    expect(url).toBe(`${API_URL}/api/auth/register`)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.headers.Authorization).toBeUndefined()
    expect(body).toEqual(payload)
  })

  it('409: сообщение сервера о занятом email', async () => {
    respondWith(409, RESPONSES.register409)

    await expect(realApi.register(payload)).rejects.toMatchObject({
      status: 409,
      message: 'Пользователь с таким email уже существует',
    })
  })

  it('422 «Пароли не совпадают» (model_validator) попадает в поле подтверждения', async () => {
    respondWith(422, RESPONSES.register422Mismatch)

    const error = await realApi.register(payload).catch((e) => e)
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toHaveProperty('passwordConfirm')
  })

  it('422 по email попадает в поле email', async () => {
    respondWith(422, RESPONSES.register422Email)

    const error = await realApi.register(payload).catch((e) => e)
    expect(error.status).toBe(422)
    expect(error.fieldErrors).toEqual({ email: 'Введите корректный email' })
  })
})

describe('POST /api/auth/login', () => {
  it('200: токен берётся из access_token', async () => {
    respondWith(200, RESPONSES.login200)

    const data = await realApi.login({ email: 'anton@test.ru', password: 'password123' })

    expect(extractToken(data)).toBe('header.payload.signature')
    const { url, body } = lastRequest()
    expect(url).toBe(`${API_URL}/api/auth/login`)
    expect(body).toEqual({ email: 'anton@test.ru', password: 'password123' })
  })

  it('401: единое сообщение, сохранённый токен не трогается', async () => {
    localStorage.setItem(TOKEN_KEY, 'old-token')
    respondWith(401, RESPONSES.login401)

    await expect(
      realApi.login({ email: 'anton@test.ru', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401, message: 'Неверный email или пароль' })
    expect(localStorage.getItem(TOKEN_KEY)).toBe('old-token')
  })

  it('пароль не попадает в URL (SEC-AUTH-04)', async () => {
    respondWith(200, RESPONSES.login200)
    await realApi.login({ email: 'anton@test.ru', password: 'password123' })

    expect(lastRequest().url).not.toContain('password123')
  })
})

describe('GET /api/auth/me', () => {
  it('отправляет токен только в заголовке Authorization (SEC-JWT-06)', async () => {
    localStorage.setItem(TOKEN_KEY, 'header.payload.signature')
    respondWith(200, RESPONSES.register201)

    await expect(realApi.me()).resolves.toEqual(RESPONSES.register201)

    const { url, options } = lastRequest()
    expect(url).toBe(`${API_URL}/api/auth/me`)
    expect(url).not.toContain('header.payload.signature')
    expect(options.headers.Authorization).toBe('Bearer header.payload.signature')
  })

  it('401: токен удаляется, приложение получает событие выхода (UC-03 A1, SEC-SESS-03)', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    respondWith(401, RESPONSES.me401)
    const onUnauthorized = vi.fn()
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)

    await expect(realApi.me()).rejects.toMatchObject({ status: 401 })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  })
})

describe('ошибки сети и сервера', () => {
  it('сервер недоступен: понятное сообщение, статус 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(realApi.me()).rejects.toMatchObject({ status: 0, message: NETWORK_ERROR_MESSAGE })
  })

  it('500 без JSON: общее сообщение без подробностей сервера (SEC-ERR-03)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token I in JSON')
      },
    })

    await expect(realApi.me()).rejects.toMatchObject({
      status: 500,
      message: 'Ошибка сервера. Повторите попытку позже.',
    })
  })
})
