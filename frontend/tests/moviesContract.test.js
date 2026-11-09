// Контракт афиши с настоящим backend (WBS 4.5): какие запросы уходит и как читается ответ.
// fetch подменяется; формат ответов — из раздела «Контракт API» в frontend/README.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { realApi } from '../src/api/movies'
import { API_URL } from '../src/config'
import { normalizeMovie, normalizeSession, toList } from '../src/utils/movies'

const TOKEN_KEY = 'bileton_access_token'

const MOVIES = [
  {
    id: 1,
    title: 'Северное сияние',
    genres: ['драма'],
    duration_minutes: 128,
    age_rating: '12+',
    poster_url: null,
  },
]

const SESSIONS = [
  {
    id: 101,
    movie_id: 1,
    starts_at: '2026-11-10T19:40:00+03:00',
    hall: { id: 1, name: 'Зал 1' },
    price: 450,
  },
]

let fetchMock

function respondWith(status, body) {
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body })
}

function lastRequest() {
  const [url, options] = fetchMock.mock.calls.at(-1)
  return { url, options }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/movies', () => {
  it('публичный запрос без токена', async () => {
    localStorage.setItem(TOKEN_KEY, 'header.payload.signature')
    respondWith(200, MOVIES)

    const data = await realApi.movies()

    const { url, options } = lastRequest()
    expect(url).toBe(`${API_URL}/api/movies`)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBeUndefined()
    expect(toList(data).map(normalizeMovie)[0]).toMatchObject({
      id: '1',
      title: 'Северное сияние',
      durationMinutes: 128,
      ageRating: '12+',
    })
  })

  it('200 и пустой массив — не ошибка', async () => {
    respondWith(200, [])
    await expect(realApi.movies()).resolves.toEqual([])
  })

  it('500 — ошибка с понятным сообщением (для кнопки «Повторить»)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('not json')
      },
    })
    await expect(realApi.movies()).rejects.toMatchObject({
      status: 500,
      message: 'Ошибка сервера. Повторите попытку позже.',
    })
  })
})

describe('GET /api/sessions', () => {
  it('фильтр по movie_id в query-параметре', async () => {
    respondWith(200, SESSIONS)

    const data = await realApi.sessions('1')

    expect(lastRequest().url).toBe(`${API_URL}/api/sessions?movie_id=1`)
    const [session] = toList(data).map(normalizeSession)
    expect(session).toMatchObject({ id: '101', movieId: '1', hallName: 'Зал 1', price: 450 })
    expect(session.startsAt.toISOString()).toBe('2026-11-10T16:40:00.000Z')
  })

  it('movie_id экранируется', async () => {
    respondWith(200, [])
    await realApi.sessions('a b&c')
    expect(lastRequest().url).toBe(`${API_URL}/api/sessions?movie_id=a%20b%26c`)
  })

  it('US-04: 200 и [] возвращается как пустой список, а не ошибка', async () => {
    respondWith(200, [])
    await expect(realApi.sessions('6')).resolves.toEqual([])
  })
})
