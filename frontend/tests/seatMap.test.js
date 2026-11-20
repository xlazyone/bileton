// Схема зала (WBS 5.4): нормализация ответа GET /sessions/{id}/seats и раскладка по сетке.

import { describe, expect, it } from 'vitest'
import {
  buildSeatRows,
  countFree,
  markOccupied,
  normalizeSeatMap,
  seatLabel,
} from '../src/utils/seatMap'

// Реальный ответ backend спринта 3 (сокращён до зала 2×3)
const RAW = {
  session_id: '4e424234-4495-4885-9676-5cbfd0d50d41',
  starts_at: '2026-11-19T21:30:00+03:00',
  price: 450.0,
  movie: { id: 'd69d0bcd-d60a-4822-96dd-012a41f5dcfc', title: 'Код доступа', age_rating: '16+' },
  hall: { id: 8, name: 'Зал 2', rows_count: 2, seats_per_row: 3 },
  seats: [
    { id: 1, row: 1, number: 1, status: 'free' },
    { id: 2, row: 1, number: 2, status: 'occupied' },
    { id: 3, row: 1, number: 3, status: 'free' },
    { id: 4, row: 2, number: 1, status: 'free' },
    { id: 6, row: 2, number: 3, status: 'free' },
  ],
}

describe('normalizeSeatMap', () => {
  it('сеанс, фильм, зал и места', () => {
    const seatMap = normalizeSeatMap(RAW)

    expect(seatMap.sessionId).toBe(RAW.session_id)
    expect(seatMap.startsAt.toISOString()).toBe('2026-11-19T18:30:00.000Z')
    expect(seatMap.price).toBe(450)
    expect(seatMap.movie).toEqual({ id: RAW.movie.id, title: 'Код доступа', ageRating: '16+' })
    expect(seatMap.hall).toEqual({ id: '8', name: 'Зал 2', rowsCount: 2, seatsPerRow: 3 })
    expect(seatMap.seats[1]).toEqual({ id: 2, row: 1, number: 2, status: 'occupied' })
  })

  it('неизвестный статус (reserved, paid…) считается «занято»', () => {
    const seatMap = normalizeSeatMap({ ...RAW, seats: [{ id: 9, row: 1, number: 1, status: 'paid' }] })
    expect(seatMap.seats[0].status).toBe('occupied')
  })

  it('поля row_number / seat_number тоже понимаются', () => {
    const seatMap = normalizeSeatMap({
      ...RAW,
      seats: [{ id: 9, row_number: 2, seat_number: 3, status: 'free' }],
    })
    expect(seatMap.seats[0]).toMatchObject({ row: 2, number: 3 })
  })

  it('сетка не меньше реально пришедших мест, даже если размеры зала неверные', () => {
    const seatMap = normalizeSeatMap({
      ...RAW,
      hall: { id: 1, name: 'Зал', rows_count: 1, seats_per_row: 1 },
    })
    expect(seatMap.hall).toMatchObject({ rowsCount: 2, seatsPerRow: 3 })
  })
})

describe('buildSeatRows', () => {
  it('ряды по порядку, место с номером N — в позиции N, пропуски — null', () => {
    const rows = buildSeatRows(normalizeSeatMap(RAW))

    expect(rows.map((row) => row.row)).toEqual([1, 2])
    expect(rows[0].cells.map((seat) => seat?.id ?? null)).toEqual([1, 2, 3])
    expect(rows[1].cells.map((seat) => seat?.id ?? null)).toEqual([4, null, 6])
  })
})

describe('помощники', () => {
  it('countFree', () => {
    expect(countFree(normalizeSeatMap(RAW))).toBe(4)
  })

  it('markOccupied помечает место занятым и не меняет исходную схему', () => {
    const seatMap = normalizeSeatMap(RAW)
    const updated = markOccupied(seatMap, [3])

    expect(updated.seats.find((seat) => seat.id === 3).status).toBe('occupied')
    expect(seatMap.seats.find((seat) => seat.id === 3).status).toBe('free')
    expect(countFree(updated)).toBe(3)
  })

  it('seatLabel', () => {
    expect(seatLabel({ row: 3, number: 7 })).toBe('Ряд 3, место 7')
  })
})
