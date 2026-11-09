// Приведение ответов GET /movies и GET /sessions к одному виду + форматирование для карточек.
//
// Контракт ещё фиксирует Lead Dev (WBS 4.3), поэтому нормализаторы принимают несколько
// вариантов имён полей. Ожидаемый вариант описан в frontend/README.md, раздел «Контракт API».

/** Ответ API -> массив (поддерживает и [..], и {items: [..]}). */
export function toList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  return []
}

function toGenres(value) {
  if (Array.isArray(value)) {
    return value
      .map((genre) => (typeof genre === 'string' ? genre : genre?.name))
      .filter(Boolean)
      .map((genre) => genre.trim())
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((genre) => genre.trim())
      .filter(Boolean)
  }
  return []
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * @returns {{ id: string, title: string, genres: string[], durationMinutes: number | null,
 *             ageRating: string | null, posterUrl: string | null, description: string | null }}
 */
export function normalizeMovie(raw) {
  const ageRating = raw.age_rating ?? raw.ageRating ?? null
  return {
    id: String(raw.id),
    title: raw.title ?? raw.name ?? 'Без названия',
    genres: toGenres(raw.genres ?? raw.genre),
    durationMinutes: toNumber(raw.duration_minutes ?? raw.duration_min ?? raw.duration),
    ageRating:
      ageRating === null ? null : /^\d+$/.test(String(ageRating)) ? `${ageRating}+` : String(ageRating),
    posterUrl: raw.poster_url ?? raw.posterUrl ?? raw.poster ?? null,
    description: raw.description ?? null,
  }
}

function toHallName(raw) {
  const hall = raw.hall
  if (hall && typeof hall === 'object') {
    if (hall.name) return hall.name
    if (hall.number !== undefined && hall.number !== null) return `Зал ${hall.number}`
  }
  if (typeof hall === 'string' && hall.trim()) return hall.trim()
  if (raw.hall_name) return raw.hall_name
  const number = raw.hall_number ?? (typeof hall === 'number' ? hall : null)
  if (number !== null && number !== undefined) return `Зал ${number}`
  return null
}

/**
 * @returns {{ id: string, movieId: string | null, startsAt: Date, hallName: string | null,
 *             price: number | null }}
 */
export function normalizeSession(raw) {
  const movieId = raw.movie_id ?? raw.movieId ?? null
  return {
    id: String(raw.id),
    movieId: movieId === null ? null : String(movieId),
    startsAt: new Date(raw.starts_at ?? raw.start_time ?? raw.startsAt),
    hallName: toHallName(raw),
    price: toNumber(raw.price),
  }
}

/** 130 -> «2 ч 10 мин», 90 -> «1 ч 30 мин», 45 -> «45 мин» (с неразрывными пробелами). */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  // Неразрывные пробелы: «2 ч» и «8 мин» не разрываются переносом строки
  if (!hours) return `${rest}\u00a0мин`
  return rest ? `${hours}\u00a0ч ${rest}\u00a0мин` : `${hours}\u00a0ч`
}

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

/** 450 -> «450 ₽» (пробел внутри — неразрывный). */
export function formatPrice(price) {
  if (price === null || price === undefined) return null
  return priceFormatter.format(price)
}

export function formatGenres(genres) {
  return genres.join(', ')
}
