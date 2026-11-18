// Мок-сервер афиши и расписания — пока у backend нет GET /movies и GET /sessions (WBS 4.3).
// Отвечает в формате, описанном в frontend/README.md («Контракт API»).
//
// Сеансы строятся от текущей даты, поэтому «Сегодня» и «Завтра» всегда есть.
// У фильма «Тихая гавань» сеансов нет — на нём проверяется пустое расписание (US-04).
//
// Сценарии для ручной проверки (только в демо-режиме) — параметр адресной строки ?mock=…
//   /?mock=empty  — афиша пуста и у всех фильмов нет сеансов
//   /?mock=error  — сервер недоступен (сообщение и кнопка «Повторить»)
//   /?mock=slow   — ответ через 3 секунды (видно состояние загрузки)

import { ApiError, NETWORK_ERROR_MESSAGE } from './client'

const IS_TEST = import.meta.env.MODE === 'test'
const DELAY_MS = IS_TEST ? 0 : 400
const SCENARIOS = ['normal', 'empty', 'error', 'slow']

let forcedScenario = null

/** Для автотестов: принудительно включить сценарий (null — вернуть обычный). */
export function setMockScenario(scenario) {
  forcedScenario = scenario
}

function currentScenario() {
  if (forcedScenario) return forcedScenario
  if (IS_TEST || typeof window === 'undefined') return 'normal'
  const fromUrl = new URLSearchParams(window.location.search).get('mock')
  return SCENARIOS.includes(fromUrl) ? fromUrl : 'normal'
}

async function respond(build) {
  const scenario = currentScenario()
  await new Promise((resolve) => setTimeout(resolve, scenario === 'slow' ? 3000 : DELAY_MS))
  if (scenario === 'error') throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  return scenario === 'empty' ? [] : build()
}

const MOVIES = [
  {
    id: 1,
    title: 'Северное сияние',
    genres: ['драма', 'приключения'],
    duration_minutes: 128,
    age_rating: '12+',
    poster_url: null,
  },
  {
    id: 2,
    title: 'Код доступа',
    genres: ['триллер', 'фантастика'],
    duration_minutes: 114,
    age_rating: '16+',
    poster_url: null,
  },
  {
    id: 3,
    title: 'Лето в Звёздочке',
    genres: ['семейный', 'комедия'],
    duration_minutes: 96,
    age_rating: '6+',
    poster_url: null,
  },
  {
    id: 4,
    title: 'Последний рейс',
    genres: ['боевик'],
    duration_minutes: 141,
    age_rating: '18+',
    poster_url: null,
  },
  {
    id: 5,
    title: 'Тайна старого маяка',
    genres: ['детектив', 'мистика'],
    duration_minutes: 107,
    age_rating: '12+',
    poster_url: null,
  },
  {
    id: 6,
    title: 'Тихая гавань',
    genres: ['мелодрама'],
    duration_minutes: 102,
    age_rating: '16+',
    poster_url: null,
  },
]

const HALLS = [
  { id: 1, name: 'Зал 1' },
  { id: 2, name: 'Зал 2' },
  { id: 3, name: 'Зал 3 · VIP' },
]

// [смещение в днях, часы, минуты, зал, цена] — для каждого фильма свой набор
const PLAN = {
  1: [
    [0, 9, 30, 0, 300],
    [0, 13, 15, 1, 350],
    [0, 19, 40, 0, 450],
    [0, 22, 10, 2, 650],
    [1, 11, 0, 0, 300],
    [1, 18, 20, 1, 450],
    [3, 20, 0, 2, 650],
  ],
  2: [
    [0, 10, 0, 1, 300],
    [0, 21, 30, 1, 450],
    [1, 16, 45, 0, 400],
    [2, 19, 0, 2, 600],
    [2, 23, 15, 1, 400],
  ],
  3: [
    [0, 8, 45, 2, 250],
    [0, 12, 0, 0, 250],
    [1, 10, 30, 0, 250],
    [1, 14, 10, 1, 300],
    [4, 11, 20, 0, 250],
  ],
  4: [
    [1, 20, 30, 1, 450],
    [1, 23, 0, 1, 450],
    [2, 21, 45, 2, 650],
  ],
  5: [
    [0, 17, 5, 2, 550],
    [0, 23, 30, 0, 400],
    [-1, 20, 0, 0, 400], // вчерашний сеанс — не должен показываться
    [2, 18, 0, 1, 400],
  ],
  6: [],
}

function buildSessions(movieId) {
  const plan = PLAN[movieId] ?? []
  const today = new Date()
  // Перемешиваем порядок, чтобы проверять сортировку на клиенте
  return plan
    .map(([dayOffset, hours, minutes, hallIndex, price], index) => {
      const startsAt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + dayOffset,
        hours,
        minutes,
      )
      return {
        id: movieId * 100 + index + 1,
        movie_id: movieId,
        starts_at: startsAt.toISOString(),
        hall: HALLS[hallIndex],
        price,
      }
    })
    .reverse()
}

/** GET /api/movies */
export function getMovies() {
  return respond(() => MOVIES.map((movie) => ({ ...movie })))
}

/** GET /api/sessions?movie_id=… */
export function getSessions(movieId) {
  return respond(() => buildSessions(Number(movieId)))
}
