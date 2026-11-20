// Страница выбора мест через интерфейс (WBS 5.4, 5.5, сценарии 5.7).
// Авторизация — мок-сервер, схема зала и брони — подменённый fetch с ответами реального backend.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import AuthProvider from '../src/context/AuthProvider'
import { formatTime } from '../src/utils/schedule'

const TOKEN_KEY = 'bileton_access_token'
const VIEWER_TOKEN = 'mock-token.00000000-0000-4000-8000-000000000001'
const SESSION_ID = '4e424234-4495-4885-9676-5cbfd0d50d41'
const SEATS_PATH = `/sessions/${SESSION_ID}/seats`

// Зал 2×3: место 1-2 занято, в ряду 2 нет места 2
function seatMap(overrides = {}) {
  return {
    session_id: SESSION_ID,
    starts_at: '2026-11-19T21:30:00+03:00',
    price: 450.0,
    movie: { id: 'movie-1', title: 'Код доступа', age_rating: '16+' },
    hall: { id: 8, name: 'Зал 2', rows_count: 2, seats_per_row: 3 },
    seats: [
      { id: 11, row: 1, number: 1, status: 'free' },
      { id: 12, row: 1, number: 2, status: 'occupied' },
      { id: 13, row: 1, number: 3, status: 'free' },
      { id: 21, row: 2, number: 1, status: 'free' },
      { id: 23, row: 2, number: 3, status: 'free' },
    ],
    ...overrides,
  }
}

function json(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

let fetchMock
let seatMapResponses
let bookingResponses

beforeEach(() => {
  seatMapResponses = []
  bookingResponses = []
  fetchMock = vi.fn(async (url, options) => {
    if (url.endsWith('/api/bookings') && options.method === 'POST') {
      const next = bookingResponses.shift()
      if (next instanceof Error) throw next
      return next
    }
    if (url.includes('/api/sessions/') && url.endsWith('/seats')) {
      return seatMapResponses.length > 1 ? seatMapResponses.shift() : seatMapResponses[0]
    }
    throw new Error(`Неожиданный запрос: ${options.method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  localStorage.setItem(TOKEN_KEY, VIEWER_TOKEN)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderSeats() {
  return render(
    <MemoryRouter initialEntries={[SEATS_PATH]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

const seat = (row, number) => screen.getByRole('button', { name: new RegExp(`^Ряд ${row}, место ${number},`) })
const bookButton = () => screen.getByRole('button', { name: 'Забронировать' })

function bookingCalls() {
  return fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/bookings'))
}

describe('5.4 Схема зала', () => {
  it('данные о сеансе и занятости загружаются с backend', async () => {
    seatMapResponses.push(json(200, seatMap()))
    renderSeats()

    expect(await screen.findByRole('heading', { name: 'Выбор мест' })).toBeInTheDocument()
    expect(screen.getByText('Код доступа')).toBeInTheDocument()
    expect(screen.getByText(/Зал 2 · 450\s₽/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Схема зала «Зал 2»' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Ряд \d, место \d,/ })).toHaveLength(5)
    expect(fetchMock.mock.calls[0][0]).toMatch(new RegExp(`/api/sessions/${SESSION_ID}/seats$`))
  })

  it('занятые места не кликабельны', async () => {
    seatMapResponses.push(json(200, seatMap()))
    renderSeats()

    await screen.findByRole('heading', { name: 'Выбор мест' })
    expect(seat(1, 2)).toBeDisabled()
    expect(seat(1, 2)).toHaveAccessibleName('Ряд 1, место 2, занято')
    expect(seat(1, 1)).not.toBeDisabled()
  })

  it('выбор одного места снимает предыдущий выбор, повторный клик — снимает выбор', async () => {
    const user = userEvent.setup()
    seatMapResponses.push(json(200, seatMap()))
    renderSeats()
    await screen.findByRole('heading', { name: 'Выбор мест' })

    expect(bookButton()).toBeDisabled()

    await user.click(seat(1, 1))
    expect(seat(1, 1)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Ряд 1, место 1')).toBeInTheDocument()
    expect(bookButton()).toBeEnabled()

    await user.click(seat(2, 3))
    expect(seat(1, 1)).toHaveAttribute('aria-pressed', 'false')
    expect(seat(2, 3)).toHaveAttribute('aria-pressed', 'true')

    await user.click(seat(2, 3))
    expect(seat(2, 3)).toHaveAttribute('aria-pressed', 'false')
    expect(bookButton()).toBeDisabled()
  })

  it('сеанс не найден (404)', async () => {
    seatMapResponses.push(json(404, { detail: 'Сеанс не найден' }))
    renderSeats()

    expect(await screen.findByText('Сеанс не найден')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← К афише' })).toBeInTheDocument()
  })

  it('ошибка сети при загрузке схемы — «Повторить»', async () => {
    const user = userEvent.setup()
    seatMapResponses.push(json(503, null), json(200, seatMap()))
    renderSeats()

    await user.click(await screen.findByRole('button', { name: 'Повторить' }))

    expect(await screen.findByRole('heading', { name: 'Выбор мест' })).toBeInTheDocument()
  })
})

describe('5.5 Бронирование', () => {
  it('201: запрос с session_id и seat_id, место отмечено как ваша бронь', async () => {
    const user = userEvent.setup()
    seatMapResponses.push(json(200, seatMap()))
    bookingResponses.push(
      json(201, {
        id: 'b-1',
        session_id: SESSION_ID,
        seat_id: 13,
        status: 'reserved',
        created_at: '2026-11-19T18:12:27+03:00',
        expires_at: '2026-11-19T18:27:27+03:00',
      }),
    )
    renderSeats()
    await screen.findByRole('heading', { name: 'Выбор мест' })

    await user.click(seat(1, 3))
    await user.click(bookButton())

    const success = await screen.findByText(/Место забронировано: Ряд 1, место 3\./)
    expect(success).toBeInTheDocument()
    const until = formatTime(new Date('2026-11-19T18:27:27+03:00')) // в часовом поясе компьютера
    expect(within(success.closest('.alert')).getByText(new RegExp(`Бронь действует до ${until}`))).toBeInTheDocument()
    expect(seat(1, 3)).toHaveAccessibleName('Ряд 1, место 3, ваша бронь')
    expect(seat(1, 1)).toBeDisabled() // после брони схема заблокирована
    const [[, options]] = bookingCalls()
    expect(JSON.parse(options.body)).toEqual({ session_id: SESSION_ID, seat_id: 13 })
    expect(options.headers.Authorization).toBe(`Bearer ${VIEWER_TOKEN}`)
  })

  it('409: сообщение, место занято, выбор снят, схема перезапрошена', async () => {
    const user = userEvent.setup()
    seatMapResponses.push(
      json(200, seatMap()),
      // после 409 backend отдаёт свежую схему: занято уже и другое место
      json(200, seatMap({
        seats: [
          { id: 11, row: 1, number: 1, status: 'occupied' },
          { id: 12, row: 1, number: 2, status: 'occupied' },
          { id: 13, row: 1, number: 3, status: 'occupied' },
          { id: 21, row: 2, number: 1, status: 'free' },
          { id: 23, row: 2, number: 3, status: 'free' },
        ],
      })),
    )
    bookingResponses.push(
      json(409, {
        detail: {
          code: 'SEAT_ALREADY_BOOKED',
          message: 'Это место уже забронировано',
          session_id: SESSION_ID,
          seat_id: 13,
        },
      }),
    )
    renderSeats()
    await screen.findByRole('heading', { name: 'Выбор мест' })

    await user.click(seat(1, 3))
    await user.click(bookButton())

    expect(
      await screen.findByText('Это место уже забронировано. Выберите другое место — схема зала обновлена.'),
    ).toBeInTheDocument()
    expect(seat(1, 3)).toBeDisabled()
    expect(bookButton()).toBeDisabled()
    // Свежая схема применилась: занято и место 1-1
    await vi.waitFor(() => expect(seat(1, 1)).toBeDisabled())
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/seats'))).toHaveLength(2)

    // Можно выбрать другое место
    await user.click(seat(2, 1))
    expect(bookButton()).toBeEnabled()
  })

  it('ошибка сети при брони: сообщение, выбор сохраняется для повтора', async () => {
    const user = userEvent.setup()
    seatMapResponses.push(json(200, seatMap()))
    bookingResponses.push(new TypeError('Failed to fetch'))
    renderSeats()
    await screen.findByRole('heading', { name: 'Выбор мест' })

    await user.click(seat(2, 1))
    await user.click(bookButton())

    expect(await screen.findByText(/Не удалось связаться с сервером/)).toBeInTheDocument()
    expect(seat(2, 1)).toHaveAttribute('aria-pressed', 'true')
    expect(bookButton()).toBeEnabled()
  })

  it('двойной клик по «Забронировать» отправляет один запрос', async () => {
    const user = userEvent.setup()
    seatMapResponses.push(json(200, seatMap()))
    let resolveBooking
    bookingResponses.push(new Promise((resolve) => (resolveBooking = resolve)))
    renderSeats()
    await screen.findByRole('heading', { name: 'Выбор мест' })

    await user.click(seat(1, 1))
    await user.dblClick(bookButton())
    resolveBooking(
      json(201, {
        id: 'b-2',
        session_id: SESSION_ID,
        seat_id: 11,
        status: 'reserved',
        created_at: '2026-11-19T18:12:27+03:00',
        expires_at: '2026-11-19T18:27:27+03:00',
      }),
    )

    await screen.findByText(/Место забронировано/)
    expect(bookingCalls()).toHaveLength(1)
  })
})
