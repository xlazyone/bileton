// Сценарии US-01…US-05 через интерфейс (на мок-сервере mockCinema.js).
// Тест-кейсы пустого расписания (WBS 4.6) — блок «US-04».

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { setMockScenario } from '../src/api/mockCinema'
import AuthProvider from '../src/context/AuthProvider'

const TOKEN_KEY = 'bileton_access_token'
const VIEWER_TOKEN = 'mock-token.00000000-0000-4000-8000-000000000001'

// В моках у фильма 6 «Тихая гавань» сеансов нет, у фильма 4 «Последний рейс» — только будущие
const MOVIE_WITHOUT_SESSIONS = '/movies/6'
const MOVIE_WITH_FUTURE_SESSIONS = '/movies/4'

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  setMockScenario(null)
})

describe('US-01 Афиша', () => {
  it('доступна гостю: карточки с названием, жанрами, длительностью и рейтингом', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Афиша' })).toBeInTheDocument()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(6)

    const first = within(cards[0])
    expect(first.getByRole('heading', { name: 'Северное сияние' })).toBeInTheDocument()
    expect(first.getByText('драма, приключения')).toBeInTheDocument()
    // Testing Library схлопывает пробелы (в т. ч. неразрывные) в обычные
    expect(first.getByText(/^2\s*ч\s*8\s*мин$/)).toBeInTheDocument()
    expect(first.getByText('12+')).toBeInTheDocument()
    expect(first.getByRole('img', { name: 'Постер фильма «Северное сияние»' })).toBeInTheDocument()
  })

  it('пустая афиша — заглушка', async () => {
    setMockScenario('empty')
    renderApp('/')

    expect(await screen.findByText('Афиша пока пуста')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('ошибка сети — сообщение и «Повторить», повтор загружает афишу', async () => {
    const user = userEvent.setup()
    setMockScenario('error')
    renderApp('/')

    expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument()
    expect(screen.getByText(/Не удалось связаться с сервером/)).toBeInTheDocument()

    setMockScenario(null)
    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findAllByRole('article')).toHaveLength(6)
  })
})

describe('US-02 / US-03 Расписание', () => {
  it('клик по карточке открывает расписание фильма', async () => {
    const user = userEvent.setup()
    renderApp('/')

    await user.click(await screen.findByRole('link', { name: 'Код доступа — расписание сеансов' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Код доступа' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Расписание' })).toBeInTheDocument()
  })

  it('сеансы сгруппированы: завтра, затем следующий день; в карточке время, зал и цена', async () => {
    renderApp(MOVIE_WITH_FUTURE_SESSIONS)

    const days = await screen.findAllByRole('heading', { level: 3 })
    expect(days.map((day) => day.textContent)).toHaveLength(2)
    expect(days[0].textContent).toMatch(/^Завтра, /)

    const tomorrow = within(days[0].closest('section'))
    const sessions = tomorrow.getAllByRole('button')
    expect(sessions.map((button) => button.querySelector('.session__time').textContent)).toEqual([
      '20:30',
      '23:00',
    ])
    expect(within(sessions[0]).getByText('Зал 2')).toBeInTheDocument()
    expect(within(sessions[0]).getByText(/450\s₽/)).toBeInTheDocument()
  })

  it('кнопка возврата к афише', async () => {
    const user = userEvent.setup()
    renderApp(MOVIE_WITH_FUTURE_SESSIONS)

    await user.click(await screen.findByRole('link', { name: '← К афише' }))

    expect(await screen.findByRole('heading', { name: 'Афиша' })).toBeInTheDocument()
  })

  it('несуществующий фильм', async () => {
    renderApp('/movies/999')
    expect(await screen.findByText('Фильм не найден')).toBeInTheDocument()
  })
})

describe('US-04 Пустое расписание (тест-кейсы 4.6)', () => {
  it('ТК-4.6-01: GET /sessions вернул [] — заглушка «На этот фильм пока нет сеансов»', async () => {
    renderApp(MOVIE_WITHOUT_SESSIONS)

    expect(await screen.findByText('На этот фильм пока нет сеансов')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Зал/ })).not.toBeInTheDocument()
  })

  it('ТК-4.6-02: пустой ответ не показывается как ошибка сервера', async () => {
    renderApp(MOVIE_WITHOUT_SESSIONS)

    await screen.findByText('На этот фильм пока нет сеансов')
    expect(screen.queryByText('Не удалось загрузить данные')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Тихая гавань' })).toBeInTheDocument()
  })

  it('ТК-4.6-03: из заглушки можно вернуться к выбору фильма', async () => {
    const user = userEvent.setup()
    renderApp(MOVIE_WITHOUT_SESSIONS)

    await user.click(await screen.findByRole('link', { name: 'Выбрать другой фильм' }))

    expect(await screen.findByRole('heading', { name: 'Афиша' })).toBeInTheDocument()
  })

  it('ТК-4.6-04: пустая афиша (empty) — у фильма тоже показывается заглушка, а не ошибка', async () => {
    setMockScenario('empty')
    renderApp('/movies/1')

    // Фильма в пустой афише нет — честно сообщаем, а не падаем
    expect(await screen.findByText('Фильм не найден')).toBeInTheDocument()
    expect(screen.queryByText('Не удалось загрузить данные')).not.toBeInTheDocument()
  })

  it('ТК-4.6-05: ошибка сети на расписании — это ошибка с «Повторить», а не пустое расписание', async () => {
    setMockScenario('error')
    renderApp(MOVIE_WITH_FUTURE_SESSIONS)

    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeInTheDocument()
    expect(screen.queryByText('На этот фильм пока нет сеансов')).not.toBeInTheDocument()
  })
})

describe('US-05 Переход к покупке билета', () => {
  it('гость: предложение войти, после входа — выбор мест с тем же сеансом', async () => {
    const user = userEvent.setup()
    renderApp(MOVIE_WITH_FUTURE_SESSIONS)

    const [firstSession] = await screen.findAllByRole('button', { name: /Зал/ })
    await user.click(firstSession)

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(screen.getByText('Чтобы выбрать места, войдите или зарегистрируйтесь.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'viewer@bileton.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('heading', { name: 'Выбор мест' })).toBeInTheDocument()
    expect(screen.getByText('Последний рейс')).toBeInTheDocument()
    expect(screen.getByText('Зал 2')).toBeInTheDocument()
    expect(document.querySelector('[data-session-id="401"]')).not.toBeNull()
  })

  it('авторизованный зритель сразу попадает на выбор мест', async () => {
    const user = userEvent.setup()
    localStorage.setItem(TOKEN_KEY, VIEWER_TOKEN)
    renderApp(MOVIE_WITH_FUTURE_SESSIONS)

    const [firstSession] = await screen.findAllByRole('button', { name: /Зал/ })
    await user.click(firstSession)

    expect(await screen.findByRole('heading', { name: 'Выбор мест' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Вход' })).not.toBeInTheDocument()
  })

  it('после явного выхода повторный вход ведёт на афишу, а не на прошлую страницу', async () => {
    const user = userEvent.setup()
    localStorage.setItem(TOKEN_KEY, VIEWER_TOKEN)
    renderApp('/sessions/401/seats')

    await screen.findByRole('heading', { name: 'Выбор мест' })
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    await screen.findByRole('heading', { name: 'Вход' })
    expect(screen.queryByText('Чтобы выбрать места, войдите или зарегистрируйтесь.')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'viewer@bileton.ru')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('heading', { name: 'Афиша' })).toBeInTheDocument()
  })
})
