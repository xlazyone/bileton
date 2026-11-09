// Настройки из переменных окружения Vite (frontend/.env.local, см. .env.example).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

// По умолчанию работаем на моках; реальный API включается явным VITE_USE_MOCKS=false.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

// Афиша и сеансы (спринт 2) переключаются отдельно: авторизация на backend уже есть,
// а GET /movies и GET /sessions появятся после задачи 4.3. Пока VITE_MOCK_CINEMA не равно
// 'false', афиша работает на моках даже при VITE_USE_MOCKS=false.
export const USE_CINEMA_MOCKS = USE_MOCKS || import.meta.env.VITE_MOCK_CINEMA !== 'false'
