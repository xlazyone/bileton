import { describe, expect, it } from 'vitest'
import { extractToken } from '../src/api/auth'
import { parseErrorDetail } from '../src/api/client'
import * as mock from '../src/api/mockServer'

const NEW_USER = {
  email: 'new@bileton.ru',
  password: 'password123',
  password_confirm: 'password123',
  full_name: 'Новый Пользователь',
}

describe('parseErrorDetail (формат ошибок FastAPI)', () => {
  it('строковый detail отдаётся как есть', () => {
    expect(parseErrorDetail('Email занят', 409)).toEqual({ message: 'Email занят', fieldErrors: {} })
  })

  it('422 от Pydantic раскладывается по полям формы', () => {
    const detail = [
      { loc: ['body', 'password'], msg: 'String should have at least 8 characters', type: 'string_too_short' },
      { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' },
    ]
    const { fieldErrors } = parseErrorDetail(detail, 422)
    expect(Object.keys(fieldErrors).sort()).toEqual(['email', 'password'])
  })

  it('ошибка model_validator «Пароли не совпадают» попадает в поле подтверждения', () => {
    const detail = [{ loc: ['body'], msg: 'Value error, Пароли не совпадают', type: 'value_error' }]
    expect(parseErrorDetail(detail, 422).fieldErrors).toHaveProperty('passwordConfirm')
  })

  it('без detail — сообщение по коду', () => {
    expect(parseErrorDetail(undefined, 503).message).toMatch(/Ошибка сервера/)
  })
})

describe('extractToken', () => {
  it('понимает access_token и token', () => {
    expect(extractToken({ access_token: 'a', token_type: 'bearer' })).toBe('a')
    expect(extractToken({ token: 'b' })).toBe('b')
    expect(extractToken({})).toBeNull()
  })
})

describe('мок-сервер повторяет контракт', () => {
  it('register: 201 и поля UserRead, роль viewer, без пароля', async () => {
    const user = await mock.register(NEW_USER)
    expect(user).toMatchObject({ email: NEW_USER.email, full_name: NEW_USER.full_name, role: 'viewer', is_active: true })
    expect(user).toHaveProperty('id')
    expect(user).toHaveProperty('created_at')
    expect(user).not.toHaveProperty('password')
  })

  it('register: 409, если email занят (без учёта регистра)', async () => {
    await expect(mock.register({ ...NEW_USER, email: 'Viewer@Bileton.ru' })).rejects.toMatchObject({ status: 409 })
  })

  it('register: 422 при коротком пароле и несовпадении', async () => {
    await expect(
      mock.register({ ...NEW_USER, password: '123', password_confirm: '321' }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('login + me: токен выдаётся и по нему возвращается профиль', async () => {
    const { access_token: token } = await mock.login({ email: 'viewer@bileton.ru', password: 'password123' })
    const user = await mock.me(token)
    expect(user.email).toBe('viewer@bileton.ru')
  })

  it('login: 401 при неверном пароле и несуществующем email', async () => {
    await expect(mock.login({ email: 'viewer@bileton.ru', password: 'wrong-pass' })).rejects.toMatchObject({ status: 401 })
    await expect(mock.login({ email: 'nobody@bileton.ru', password: 'password123' })).rejects.toMatchObject({ status: 401 })
  })

  it('me: 401 без токена и с поддельным токеном', async () => {
    await expect(mock.me(null)).rejects.toMatchObject({ status: 401 })
    await expect(mock.me('garbage')).rejects.toMatchObject({ status: 401 })
  })
})
