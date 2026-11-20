// Схема зала (WBS 5.4): приведение ответа GET /sessions/{id}/seats к одному виду
// и раскладка мест по сетке «ряды × места» для CSS Grid.

export const SEAT_STATUS = {
  FREE: 'free',
  OCCUPIED: 'occupied',
}

function toNumber(value, fallback = null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/**
 * @returns {{ sessionId: string, startsAt: Date, price: number | null,
 *   movie: { id: string, title: string, ageRating: string | null },
 *   hall: { id: string, name: string, rowsCount: number, seatsPerRow: number },
 *   seats: Array<{ id: number, row: number, number: number, status: 'free' | 'occupied' }> }}
 */
export function normalizeSeatMap(raw) {
  const seats = (Array.isArray(raw?.seats) ? raw.seats : []).map((seat) => ({
    id: toNumber(seat.id),
    row: toNumber(seat.row ?? seat.row_number),
    number: toNumber(seat.number ?? seat.seat_number),
    // Любой статус, кроме free, для покупателя означает «занято»
    status: seat.status === SEAT_STATUS.FREE ? SEAT_STATUS.FREE : SEAT_STATUS.OCCUPIED,
  }))

  const maxRow = Math.max(0, ...seats.map((seat) => seat.row))
  const maxNumber = Math.max(0, ...seats.map((seat) => seat.number))
  const hall = raw?.hall ?? {}

  return {
    sessionId: String(raw?.session_id ?? ''),
    startsAt: new Date(raw?.starts_at),
    price: toNumber(raw?.price),
    movie: {
      id: String(raw?.movie?.id ?? ''),
      title: raw?.movie?.title ?? 'Фильм',
      ageRating: raw?.movie?.age_rating ?? null,
    },
    hall: {
      id: String(hall.id ?? ''),
      name: hall.name ?? 'Зал',
      // Размер сетки — из зала, но не меньше реально пришедших мест
      rowsCount: Math.max(toNumber(hall.rows_count, 0), maxRow),
      seatsPerRow: Math.max(toNumber(hall.seats_per_row, 0), maxNumber),
    },
    seats,
  }
}

/**
 * Ряды для отрисовки: [{ row, cells: [seat | null] }].
 * cells[i] — место с номером i+1; null — в этой позиции места нет (проход, демонтировано).
 */
export function buildSeatRows(seatMap) {
  const { rowsCount, seatsPerRow } = seatMap.hall
  const byPosition = new Map(seatMap.seats.map((seat) => [`${seat.row}:${seat.number}`, seat]))
  return Array.from({ length: rowsCount }, (_, rowIndex) => {
    const row = rowIndex + 1
    return {
      row,
      cells: Array.from(
        { length: seatsPerRow },
        (_, numberIndex) => byPosition.get(`${row}:${numberIndex + 1}`) ?? null,
      ),
    }
  })
}

/** Количество свободных мест. */
export function countFree(seatMap) {
  return seatMap.seats.filter((seat) => seat.status === SEAT_STATUS.FREE).length
}

/** Копия схемы, где указанные места помечены занятыми (после ответа 409). */
export function markOccupied(seatMap, seatIds) {
  const ids = new Set(seatIds)
  return {
    ...seatMap,
    seats: seatMap.seats.map((seat) =>
      ids.has(seat.id) ? { ...seat, status: SEAT_STATUS.OCCUPIED } : seat,
    ),
  }
}

/** «Ряд 3, место 7». */
export function seatLabel(seat) {
  return `Ряд ${seat.row}, место ${seat.number}`
}
