// Модуль «Схема зала и бронирование» (Спринт 3, WBS 5.4–5.5). Только реальный backend, без моков.
//
//   GET  /api/sessions/{session_id}/seats [+ Bearer, необязательно]
//        -> 200 {session_id, starts_at, price, movie, hall, seats[]} | 404
//        С токеном свои брони приходят как status "mine" + expires_at; без токена — "occupied".
//   POST /api/bookings  {session_id, seat_id} + Bearer -> 201 BookingRead | 401 | 404 | 409
//
// Тело 409 (docs/requirements/seat-reservation-logic.md, раздел 5):
//   {"detail": {"code": "SEAT_ALREADY_BOOKED", "message": "...", "session_id": "...", "seat_id": 7}}

import { normalizeSeatMap } from '../utils/seatMap'
import { request } from './client'

export const SEAT_ALREADY_BOOKED = 'SEAT_ALREADY_BOOKED'

export const realApi = {
  // Токен прикладываем, чтобы увидеть свои брони. Эндпоинт публичный: битый токен даёт
  // просто схему «как гостю», а не 401
  seats: (sessionId) =>
    request(`/api/sessions/${encodeURIComponent(sessionId)}/seats`, { auth: true }),
  book: (sessionId, seatId) =>
    request('/api/bookings', {
      method: 'POST',
      body: { session_id: sessionId, seat_id: seatId },
      auth: true,
    }),
}

export async function fetchSeatMap(sessionId) {
  return normalizeSeatMap(await realApi.seats(sessionId))
}

/**
 * @returns {Promise<{ id: string, sessionId: string, seatId: number, status: string,
 *   createdAt: Date, expiresAt: Date | null }>}
 */
export async function createBooking(sessionId, seatId) {
  const data = await realApi.book(sessionId, seatId)
  return {
    id: String(data.id),
    sessionId: String(data.session_id),
    seatId: Number(data.seat_id),
    status: data.status,
    createdAt: new Date(data.created_at),
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
  }
}

/** 409 «место уже занято» (по коду из тела, а если его нет — по HTTP-статусу). */
export function isSeatConflict(error) {
  return error?.status === 409 && (!error.code || error.code === SEAT_ALREADY_BOOKED)
}
