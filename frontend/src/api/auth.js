// Запросы авторизации по контракту спринта 1 (docs/requirements/use-cases.md, Swagger /docs).
//
//   POST /api/auth/register  {email, password, password_confirm, full_name} -> 201 UserRead | 409 | 422
//   POST /api/auth/login     {email, password}        -> 200 {access_token, token_type, role} | 401 | 422
//   GET  /api/auth/me        Authorization: Bearer <token>                  -> 200 UserRead | 401
//
// Пока VITE_USE_MOCKS != 'false', те же функции отвечают из mockServer.js.

import { USE_MOCKS } from '../config'
import { getToken } from '../utils/tokenStorage'
import { ApiError, handleUnauthorized, request } from './client'
import * as mock from './mockServer'

/** Достаёт токен из ответа /login. Поддерживает {access_token} (стандарт FastAPI) и {token}. */
export function extractToken(data) {
  return data?.access_token ?? data?.token ?? null
}

/** Поля формы регистрации -> тело POST /api/auth/register. */
export function toRegisterPayload({ fullName, email, password, passwordConfirm }) {
  return {
    email: email.trim(),
    password,
    password_confirm: passwordConfirm,
    full_name: fullName.trim(),
  }
}

/** Поля формы входа -> тело POST /api/auth/login. */
export function toLoginPayload({ email, password }) {
  return { email: email.trim(), password }
}

/** Запросы к настоящему backend (используются при VITE_USE_MOCKS=false). */
export const realApi = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me', { auth: true }),
}

export function registerUser(values) {
  const payload = toRegisterPayload(values)
  return USE_MOCKS ? mock.register(payload) : realApi.register(payload)
}

/** Возвращает строку токена. */
export async function loginUser(values) {
  const payload = toLoginPayload(values)
  const data = USE_MOCKS ? await mock.login(payload) : await realApi.login(payload)

  const token = extractToken(data)
  if (!token) throw new ApiError(500, 'Сервер не вернул токен авторизации.')
  return token
}

export async function fetchCurrentUser() {
  if (!USE_MOCKS) return realApi.me()
  try {
    return await mock.me(getToken())
  } catch (error) {
    if (error.status === 401) handleUnauthorized() // как и в request(): 401 -> выход
    throw error
  }
}
