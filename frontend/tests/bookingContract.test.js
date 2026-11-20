// Контракт фронтенда с API бронирования (WBS 5.5). fetch подменяется,
// ответы — реальные ответы backend спринта 3.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBooking, fetchSeatMap, isSeatConflict, realApi } from '../src/api/booking'
import { API_URL } from '../src/config'

const TOKEN_KEY = 'bileton_access_token'
const SESSION_ID = '4e424234-4495-4885-9676-5cbfd0d50d41'

const SEAT_MAP = {
  session_id: SESSION_ID,
  starts_at: '2026-11-19T21:30:00+03:00',
  price: 450.0,
  movie: { id: 'd69d0bcd-d60a-4822-96dd-012a41f5dcfc', title: 'Код доступа', age_rating: '16+' },
  hall: { id: 8, name: 'Зал 2', rows_count: 1, seats_per_row: 2 },
  seats: [
    { id: 515, row: 1, number: 1, status: 'free' },
    { id: 516, row: 1, number: 2, status: 'occupied' },
  ],
}

const BOOKING_201 = {
  id: '4f346b9f-e73b-4763-8b7e-9d9089c4fb40',
  session_id: SESSION_ID,
  seat_id: 515,
  status: 'reserved',
  created_at: '2026-11-19T18:12:27.441056+03:00',
  expires_at: '2026-11-19T18:27:27.446075+03:00',
}

const CONFLICT_409 = {
  detail: {
    code: 'SEAT_ALREADY_BOOKED',
    message: 'Это место уже забронировано',
    session_id: SESSION_ID,
    seat_id: 516,
  },
}

let fetchMock

function respondWith(status, body) {
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body })
}

function lastRequest() {
  const [url, options] = fetchMock.mock.calls.at(-1)
  return { url, options, body: options.body ? JSON.parse(options.body) : undefined }
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/sessions/{id}/seats', () => {
  it('публичный запрос, ответ нормализуется', async () => {
    respondWith(200, SEAT_MAP)

    const seatMap = await fetchSeatMap(SESSION_ID)

    const { url, options } = lastRequest()
    expect(url).toBe(`${API_URL}/api/sessions/${SESSION_ID}/seats`)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBeUndefined()
    expect(seatMap.seats).toHaveLength(2)
    expect(seatMap.hall.seatsPerRow).toBe(2)
  })

  it('404 — ошибка со статусом (страница покажет «Сеанс не найден»)', async () => {
    respondWith(404, { detail: 'Сеанс не найден' })
    await expect(fetchSeatMap(SESSION_ID)).rejects.toMatchObject({ status: 404, message: 'Сеанс не найден' })
  })
})

describe('POST /api/bookings', () => {
  it('201: тело {session_id, seat_id} и токен в Authorization', async () => {
    localStorage.setItem(TOKEN_KEY, 'header.payload.signature')
    respondWith(201, BOOKING_201)

    const booking = await createBooking(SESSION_ID, 515)

    const { url, options, body } = lastRequest()
    expect(url).toBe(`${API_URL}/api/bookings`)
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer header.payload.signature')
    expect(body).toEqual({ session_id: SESSION_ID, seat_id: 515 })
    expect(booking).toMatchObject({ id: BOOKING_201.id, seatId: 515, status: 'reserved' })
    expect(booking.expiresAt.toISOString()).toBe('2026-11-19T15:27:27.446Z')
  })

  it('409: сообщение сервера, код SEAT_ALREADY_BOOKED и seat_id в details', async () => {
    respondWith(409, CONFLICT_409)

    const error = await realApi.book(SESSION_ID, 516).catch((e) => e)

    expect(error.status).toBe(409)
    expect(error.message).toBe('Это место уже забронировано')
    expect(error.code).toBe('SEAT_ALREADY_BOOKED')
    expect(error.details.seat_id).toBe(516)
    expect(isSeatConflict(error)).toBe(true)
  })

  it('isSeatConflict: 409 без кода тоже конфликт, другие ошибки — нет', () => {
    expect(isSeatConflict({ status: 409, code: null })).toBe(true)
    expect(isSeatConflict({ status: 409, code: 'OTHER' })).toBe(false)
    expect(isSeatConflict({ status: 404 })).toBe(false)
    expect(isSeatConflict({ status: 0 })).toBe(false)
  })

  it('401: токен удаляется (сессия истекла)', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired')
    respondWith(401, { detail: 'Невалидный или просроченный токен' })

    await expect(realApi.book(SESSION_ID, 515)).rejects.toMatchObject({ status: 401 })
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
