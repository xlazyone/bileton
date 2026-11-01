// Настройки из переменных окружения Vite (frontend/.env.local, см. .env.example).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

// По умолчанию работаем на моках; реальный API включается явным VITE_USE_MOCKS=false.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
