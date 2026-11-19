// Нормализация ответов GET /movies, GET /sessions и форматирование карточек (US-01, US-03).

import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatGenres,
  formatPrice,
  normalizeMovie,
  normalizeSession,
  toList,
} from '../src/utils/movies'

const NBSP = ' '

describe('normalizeMovie', () => {
  it('ожидаемый формат контракта', () => {
    expect(
      normalizeMovie({
        id: 7,
        title: 'Северное сияние',
        genres: ['драма', 'приключения'],
        duration_minutes: 128,
        age_rating: '12+',
        poster_url: 'https://example.com/p.jpg',
      }),
    ).toEqual({
      id: '7',
      title: 'Северное сияние',
      genres: ['драма', 'приключения'],
      durationMinutes: 128,
      ageRating: '12+',
      posterUrl: 'https://example.com/p.jpg',
      description: null,
    })
  })

  it('альтернативные имена полей: жанры строкой, duration, рейтинг числом', () => {
    const movie = normalizeMovie({ id: 'a1', title: 'X', genre: 'драма, комедия', duration: '95', age_rating: 16 })
    expect(movie.genres).toEqual(['драма', 'комедия'])
    expect(movie.durationMinutes).toBe(95)
    expect(movie.ageRating).toBe('16+')
  })

  it('жанры объектами {name}', () => {
    expect(normalizeMovie({ id: 1, title: 'X', genres: [{ name: 'боевик' }] }).genres).toEqual(['боевик'])
  })

  it('пустые поля не ломают карточку', () => {
    const movie = normalizeMovie({ id: 1, title: 'X' })
    expect(movie.genres).toEqual([])
    expect(movie.durationMinutes).toBeNull()
    expect(movie.ageRating).toBeNull()
    expect(movie.posterUrl).toBeNull()
  })
})

describe('normalizeSession', () => {
  it('зал объектом, цена числом', () => {
    const session = normalizeSession({
      id: 101,
      movie_id: 1,
      starts_at: '2026-11-10T16:30:00+03:00',
      hall: { id: 2, name: 'Зал 2' },
      price: 450,
    })
    expect(session.id).toBe('101')
    expect(session.movieId).toBe('1')
    expect(session.startsAt.toISOString()).toBe('2026-11-10T13:30:00.000Z')
    expect(session.hallName).toBe('Зал 2')
    expect(session.price).toBe(450)
  })

  it.each([
    [{ hall: { number: 3 } }, 'Зал 3'],
    [{ hall_name: 'VIP' }, 'VIP'],
    [{ hall_number: 1 }, 'Зал 1'],
    [{ hall: 'Малый зал' }, 'Малый зал'],
    [{ hall: 4 }, 'Зал 4'],
    [{}, null],
  ])('зал из %j -> %s', (fields, expected) => {
    expect(normalizeSession({ id: 1, starts_at: '2026-11-10T10:00:00Z', ...fields }).hallName).toBe(expected)
  })

  it('цена строкой (Decimal из backend) -> число', () => {
    expect(normalizeSession({ id: 1, starts_at: '2026-11-10T10:00:00Z', price: '450.00' }).price).toBe(450)
  })
})

describe('toList', () => {
  it('массив или {items: []}', () => {
    expect(toList([1, 2])).toEqual([1, 2])
    expect(toList({ items: [3] })).toEqual([3])
    expect(toList(null)).toEqual([])
  })
})

describe('форматирование', () => {
  it('длительность', () => {
    expect(formatDuration(128)).toBe(`2${NBSP}ч 8${NBSP}мин`)
    expect(formatDuration(120)).toBe(`2${NBSP}ч`)
    expect(formatDuration(45)).toBe(`45${NBSP}мин`)
    expect(formatDuration(null)).toBeNull()
  })

  it('цена в рублях без копеек', () => {
    const price = formatPrice(450)
    expect(price).toMatch(/^450\s₽$/)
    expect(formatPrice(1250)).toMatch(/^1\s250\s₽$/)
    expect(formatPrice(null)).toBeNull()
  })

  it('жанры через запятую', () => {
    expect(formatGenres(['драма', 'приключения'])).toBe('драма, приключения')
  })
})
