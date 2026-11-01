// Обёртка над fetch: базовый URL, JSON, заголовок Authorization и единый разбор ошибок.

import { API_URL } from '../config'
import { clearToken, getToken } from '../utils/tokenStorage'

// Событие «сессия больше не действительна»: его слушает AuthProvider (UC-03 A1, SEC-SESS-03)
export const UNAUTHORIZED_EVENT = 'bileton:unauthorized'

/** Токен истёк или невалиден: удаляем его и сообщаем приложению, чтобы оно разлогинило пользователя. */
export function handleUnauthorized() {
  clearToken()
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

export const NETWORK_ERROR_MESSAGE =
  'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.'

const STATUS_MESSAGES = {
  400: 'Некорректный запрос.',
  401: 'Требуется авторизация.',
  403: 'Доступ запрещён.',
  404: 'Ресурс не найден.',
  409: 'Конфликт данных.',
  422: 'Проверьте правильность заполнения полей.',
  501: 'Эта функция на сервере ещё не реализована (501).',
}

// Поля API (snake_case) -> поля форм (camelCase)
const FIELD_MAP = {
  full_name: 'fullName',
  email: 'email',
  password: 'password',
  password_confirm: 'passwordConfirm',
}

// Понятные сообщения для ошибок валидации FastAPI/Pydantic (они приходят на английском)
const FIELD_MESSAGES = {
  fullName: 'Проверьте имя',
  email: 'Введите корректный email',
  password: 'Пароль должен содержать от 8 до 128 символов',
  passwordConfirm: 'Пароли не совпадают',
}

export class ApiError extends Error {
  /**
   * @param {number} status HTTP-код (0 — сеть недоступна)
   * @param {string} message сообщение для пользователя
   * @param {Record<string, string>} [fieldErrors] ошибки по полям формы (для 422)
   */
  constructor(status, message, fieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/**
 * Разбирает detail из ответа FastAPI.
 * - строка: {"detail": "Пользователь уже существует"}
 * - 422:    {"detail": [{"loc": ["body", "password"], "msg": "...", "type": "..."}]}
 */
export function parseErrorDetail(detail, status) {
  const fallback = STATUS_MESSAGES[status] ?? (status >= 500 ? 'Ошибка сервера. Повторите попытку позже.' : 'Произошла ошибка.')

  if (typeof detail === 'string' && detail.trim()) {
    return { message: detail, fieldErrors: {} }
  }

  if (Array.isArray(detail)) {
    const fieldErrors = {}
    for (const item of detail) {
      const loc = Array.isArray(item?.loc) ? item.loc : []
      const apiField = loc[loc.length - 1]
      const field = FIELD_MAP[apiField]
      if (field) {
        fieldErrors[field] = FIELD_MESSAGES[field]
      } else if (typeof item?.msg === 'string' && item.msg.includes('Пароли не совпадают')) {
        // model_validator в UserCreate возвращает ошибку на уровне всего body
        fieldErrors.passwordConfirm = FIELD_MESSAGES.passwordConfirm
      }
    }
    return { message: fallback, fieldErrors }
  }

  return { message: fallback, fieldErrors: {} }
}

export async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // 401 на запросе с токеном — сессия закончилась, а не «неверный пароль»
    if (auth && response.status === 401) handleUnauthorized()
    const { message, fieldErrors } = parseErrorDetail(data?.detail, response.status)
    throw new ApiError(response.status, message, fieldErrors)
  }
  return data
}
