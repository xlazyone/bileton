// Мок-сервер авторизации — работает прямо в браузере, пока backend отвечает 501.
// Повторяет контракт и коды ответов: 201 / 409 / 422 для регистрации, 401 для входа и /me.
// Пользователи хранятся в localStorage, чтобы регистрация переживала перезагрузку страницы.
//
// Тестовые аккаунты (пароль у обоих: password123):
//   viewer@bileton.ru     — роль viewer
//   controller@bileton.ru — роль controller
//
// ВНИМАНИЕ: только для разработки. Пароли тут хранятся открыто — на реальном backend они хешируются.

import {
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  isValidEmail,
} from '../utils/validation'
import { ApiError } from './client'

const USERS_KEY = 'bileton_mock_users'
const TOKEN_PREFIX = 'mock-token.'
const DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 400

const SEED_USERS = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'viewer@bileton.ru',
    full_name: 'Тестовый Зритель',
    role: 'viewer',
    is_active: true,
    created_at: '2026-10-01T10:00:00Z',
    password: 'password123',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'controller@bileton.ru',
    full_name: 'Тестовый Контроллер',
    role: 'controller',
    is_active: true,
    created_at: '2026-10-01T10:00:00Z',
    password: 'password123',
  },
]

function wait() {
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS))
}

function loadUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]')
    return [...SEED_USERS, ...(Array.isArray(saved) ? saved : [])]
  } catch {
    return [...SEED_USERS]
  }
}

function saveRegisteredUser(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]')
    localStorage.setItem(USERS_KEY, JSON.stringify([...(Array.isArray(saved) ? saved : []), user]))
  } catch {
    // хранилище недоступно — пользователь проживёт до перезагрузки
  }
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toUserRead(user) {
  const { password: _password, ...publicFields } = user
  return publicFields
}

function findByEmail(email) {
  const normalized = email.trim().toLowerCase()
  return loadUsers().find((user) => user.email.toLowerCase() === normalized)
}

/** POST /api/auth/register */
export async function register(payload) {
  await wait()
  const fieldErrors = {}
  if (!isValidEmail(payload.email ?? '')) fieldErrors.email = 'Введите корректный email'
  const password = payload.password ?? ''
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    fieldErrors.password = 'Пароль должен содержать от 8 до 128 символов'
  }
  if (password !== payload.password_confirm) fieldErrors.passwordConfirm = 'Пароли не совпадают'
  if ((payload.full_name ?? '').length > FULL_NAME_MAX_LENGTH) fieldErrors.fullName = 'Проверьте имя'

  if (Object.keys(fieldErrors).length) {
    throw new ApiError(422, 'Проверьте правильность заполнения полей.', fieldErrors)
  }
  if (findByEmail(payload.email)) {
    throw new ApiError(409, 'Пользователь с таким email уже существует')
  }

  const user = {
    id: newId(),
    email: payload.email.trim(),
    full_name: payload.full_name || null,
    role: 'viewer', // роль по умолчанию (UC-01 шаг 6)
    is_active: true,
    created_at: new Date().toISOString(),
    password,
  }
  saveRegisteredUser(user)
  return toUserRead(user) // 201
}

/** POST /api/auth/login */
export async function login({ email, password }) {
  await wait()
  const user = findByEmail(email ?? '')
  if (!user || user.password !== password || !user.is_active) {
    throw new ApiError(401, 'Неверный email или пароль') // единое сообщение (UC-02 A2)
  }
  // Та же форма ответа, что у backend (TokenResponse): access_token, token_type, role
  return {
    access_token: `${TOKEN_PREFIX}${encodeURIComponent(user.id)}`,
    token_type: 'bearer',
    role: user.role,
  }
}

/** GET /api/auth/me */
export async function me(token) {
  await wait()
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    throw new ApiError(401, 'Токен отсутствует или недействителен')
  }
  const id = decodeURIComponent(token.slice(TOKEN_PREFIX.length))
  const user = loadUsers().find((candidate) => candidate.id === id)
  if (!user) throw new ApiError(401, 'Токен отсутствует или недействителен')
  return toUserRead(user)
}
