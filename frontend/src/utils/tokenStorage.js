// Хранение JWT на клиенте (UC-02 шаг 6, UC-03 шаг 2).
// Токен не попадает в URL и не пишется в консоль (DoD 3.2).

const TOKEN_KEY = 'bileton_access_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // приватный режим / хранилище недоступно — токен проживёт до перезагрузки страницы
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // нечего удалять
  }
}
