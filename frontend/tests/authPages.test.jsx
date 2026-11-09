// Сценарии UC-01..UC-04 через интерфейс (на мок-сервере).

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import AuthProvider from '../src/context/AuthProvider'

const TOKEN_KEY = 'bileton_access_token'
const VIEWER_TOKEN = 'mock-token.00000000-0000-4000-8000-000000000001'

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function fillRegisterForm(user, { fullName, email, password, passwordConfirm }) {
  if (fullName) await user.type(screen.getByLabelText('Имя'), fullName)
  if (email) await user.type(screen.getByLabelText('Email'), email)
  if (password) await user.type(screen.getByLabelText('Пароль'), password)
  if (passwordConfirm) await user.type(screen.getByLabelText('Подтверждение пароля'), passwordConfirm)
  await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))
}

async function login(user, email, password) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Пароль'), password)
  await user.click(screen.getByRole('button', { name: 'Войти' }))
}

describe('UC-01 Регистрация', () => {
  it('пустая форма не отправляется, у каждого поля сообщение', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    expect(screen.getByText('Введите имя')).toBeInTheDocument()
    expect(screen.getByText('Введите email')).toBeInTheDocument()
    expect(screen.getByText('Введите пароль')).toBeInTheDocument()
    expect(screen.getByText('Повторите пароль')).toBeInTheDocument()
  })

  it('A1: некорректный email', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegisterForm(user, { fullName: 'Антон', email: 'anton@mail', password: 'password123', passwordConfirm: 'password123' })
    expect(screen.getByText('Введите корректный email')).toBeInTheDocument()
  })

  it('A2: пароль короче 8 символов', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegisterForm(user, { fullName: 'Антон', email: 'anton@mail.ru', password: '1234567', passwordConfirm: '1234567' })
    expect(screen.getByText('Пароль должен содержать не менее 8 символов')).toBeInTheDocument()
  })

  it('A3: пароли не совпадают', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegisterForm(user, { fullName: 'Антон', email: 'anton@mail.ru', password: 'password123', passwordConfirm: 'password124' })
    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument()
  })

  it('A4: занятый email -> 409, предложение войти', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegisterForm(user, { fullName: 'Антон', email: 'viewer@bileton.ru', password: 'password123', passwordConfirm: 'password123' })

    expect(await screen.findByText(/Пользователь с таким email уже существует/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Перейти ко входу' })).toBeInTheDocument()
  })

  it('успех -> страница входа с подставленным email', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await fillRegisterForm(user, { fullName: 'Антон', email: 'anton@mail.ru', password: 'password123', passwordConfirm: 'password123' })

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(screen.getByText(/Регистрация прошла успешно/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('anton@mail.ru')
  })
})

describe('UC-02 Вход', () => {
  it('A1: кнопка заблокирована при пустых полях', () => {
    renderApp('/login')
    expect(screen.getByRole('button', { name: 'Войти' })).toBeDisabled()
  })

  it('A2: неверный пароль -> единое сообщение, токен не сохраняется', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await login(user, 'viewer@bileton.ru', 'wrong-password')

    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('viewer: токен сохранён, редирект в личный кабинет', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await login(user, 'viewer@bileton.ru', 'password123')

    expect(await screen.findByRole('heading', { name: 'Личный кабинет' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeTruthy()
  })

  it('controller: редирект в панель контроллера', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await login(user, 'controller@bileton.ru', 'password123')

    expect(await screen.findByRole('heading', { name: 'Панель контроллера' })).toBeInTheDocument()
  })
})

describe('UC-03 Выход', () => {
  it('после выхода токен удалён и открывается страница входа', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await login(user, 'viewer@bileton.ru', 'password123')
    await screen.findByRole('heading', { name: 'Личный кабинет' })

    await user.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('A1: невалидный токен очищается, редирект на вход', async () => {
    localStorage.setItem(TOKEN_KEY, 'mock-token.expired')
    renderApp('/profile')

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('UC-04 Защищённые страницы', () => {
  it('без токена /profile -> вход', async () => {
    renderApp('/profile')
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
  })

  it('A2: viewer на /controller видит «Доступ запрещён»', async () => {
    localStorage.setItem(TOKEN_KEY, VIEWER_TOKEN)
    renderApp('/controller')
    expect(await screen.findByRole('heading', { name: 'Доступ запрещён' })).toBeInTheDocument()
  })

  it('сохранённый токен восстанавливает сессию после перезагрузки', async () => {
    localStorage.setItem(TOKEN_KEY, VIEWER_TOKEN)
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Личный кабинет' })).toBeInTheDocument()
  })
})
