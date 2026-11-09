// Запросы модуля «Афиша и сеансы» (Спринт 2, WBS 4.5).
//
//   GET /api/movies                   -> 200 [Movie]    (пустой массив — афиша пуста)
//   GET /api/sessions?movie_id=<id>   -> 200 [Session]  (пустой массив — сеансов нет, это НЕ ошибка)
//
// Эндпоинты публичные — токен не нужен (US-01: доступно Гостю).
// Пока VITE_MOCK_CINEMA != 'false' (или включён общий VITE_USE_MOCKS), ответы отдаёт mockCinema.js.

import { USE_CINEMA_MOCKS } from '../config'
import { normalizeMovie, normalizeSession, toList } from '../utils/movies'
import { request } from './client'
import * as mock from './mockCinema'

/** Запросы к настоящему backend. */
export const realApi = {
  movies: () => request('/api/movies'),
  sessions: (movieId) => request(`/api/sessions?movie_id=${encodeURIComponent(movieId)}`),
}

export async function fetchMovies() {
  const data = USE_CINEMA_MOCKS ? await mock.getMovies() : await realApi.movies()
  return toList(data).map(normalizeMovie)
}

export async function fetchSessions(movieId) {
  const data = USE_CINEMA_MOCKS ? await mock.getSessions(movieId) : await realApi.sessions(movieId)
  return (
    toList(data)
      .map(normalizeSession)
      // Защита на случай, если backend проигнорирует фильтр movie_id
      .filter((session) => session.movieId === null || session.movieId === String(movieId))
  )
}

/**
 * Фильм для страницы расписания. Отдельного GET /movies/{id} в WBS нет,
 * поэтому берём фильм из списка афиши.
 */
export async function fetchMovie(movieId) {
  const movies = await fetchMovies()
  return movies.find((movie) => movie.id === String(movieId)) ?? null
}
