// Запросы авторизации по контракту спринта 1 (docs/requirements/use-cases.md, Swagger /docs).
//
//   POST /api/auth/register  {email, password, password_confirm, full_name} -> 201 UserRead | 409 | 422
//   POST /api/auth/login     {email, password}                              -> токен (схему фиксирует Lead Dev)
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

export function registerUser({ fullName, email, password, passwordConfirm }) {
  const payload = {
    email: email.trim(),
    password,
    password_confirm: passwordConfirm,
    full_name: fullName.trim(),
  }
  return USE_MOCKS
    ? mock.register(payload)
    : request('/api/auth/register', { method: 'POST', body: payload })
}

/** Возвращает строку токена. */
export async function loginUser({ email, password }) {
  const payload = { email: email.trim(), password }
  const data = USE_MOCKS
    ? await mock.login(payload)
    : await request('/api/auth/login', { method: 'POST', body: payload })

  const token = extractToken(data)
  if (!token) throw new ApiError(500, 'Сервер не вернул токен авторизации.')
  return token
}

export async function fetchCurrentUser() {
  if (!USE_MOCKS) return request('/api/auth/me', { auth: true })
  try {
    return await mock.me(getToken())
  } catch (error) {
    if (error.status === 401) handleUnauthorized() // как и в request(): 401 -> выход
    throw error
  }
}
