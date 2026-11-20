// Настройки из переменных окружения Vite (frontend/.env.local, см. .env.example).

export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

// С спринта 3 по умолчанию работаем с реальным backend.
// Мок-сервер авторизации включается явным VITE_USE_MOCKS=true (автотесты делают это сами).
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

// Моки афиши и сеансов (спринт 2) — только явным VITE_MOCK_CINEMA=true или вместе с VITE_USE_MOCKS.
// Схема зала и бронирование (спринт 3) моков не имеют: они всегда идут в backend.
export const USE_CINEMA_MOCKS = USE_MOCKS || import.meta.env.VITE_MOCK_CINEMA === 'true'
