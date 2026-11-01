import { describe, expect, it } from 'vitest'
import {
  MESSAGES,
  validateEmail,
  validateLoginForm,
  validatePassword,
  validatePasswordConfirm,
  validateRegisterForm,
} from '../src/utils/validation'

const VALID = {
  fullName: 'Антон',
  email: 'anton@example.com',
  password: 'password123',
  passwordConfirm: 'password123',
}

describe('validateEmail', () => {
  it('принимает корректный email', () => {
    expect(validateEmail('user@mail.ru')).toBeNull()
    expect(validateEmail('  user.name+tag@sub.domain.com  ')).toBeNull()
  })

  it('требует заполнить поле', () => {
    expect(validateEmail('')).toBe(MESSAGES.emailRequired)
    expect(validateEmail('   ')).toBe(MESSAGES.emailRequired)
  })

  it.each(['user', 'user@', '@mail.ru', 'user@mail', 'user mail@mail.ru', 'user@@mail.ru', 'a..b@mail.ru'])(
    'отклоняет «%s»',
    (value) => {
      expect(validateEmail(value)).toBe(MESSAGES.emailInvalid)
    },
  )
})

describe('validatePassword', () => {
  it('пароль из 8 символов подходит, из 7 — нет (как min_length=8 на backend)', () => {
    expect(validatePassword('12345678')).toBeNull()
    expect(validatePassword('1234567')).toBe(MESSAGES.passwordTooShort)
  })

  it('пароль длиннее 128 символов отклоняется (max_length=128)', () => {
    expect(validatePassword('a'.repeat(128))).toBeNull()
    expect(validatePassword('a'.repeat(129))).toBe(MESSAGES.passwordTooLong)
  })

  it('пустой пароль', () => {
    expect(validatePassword('')).toBe(MESSAGES.passwordRequired)
  })
})

describe('validatePasswordConfirm', () => {
  it('пароли совпадают', () => {
    expect(validatePasswordConfirm('password123', 'password123')).toBeNull()
  })

  it('пароли не совпадают', () => {
    expect(validatePasswordConfirm('password123', 'password124')).toBe(MESSAGES.passwordsMismatch)
  })
})

describe('validateRegisterForm', () => {
  it('валидная форма — без ошибок', () => {
    expect(validateRegisterForm(VALID)).toEqual({})
  })

  it('пустая форма — ошибка в каждом поле', () => {
    const errors = validateRegisterForm({ fullName: '', email: '', password: '', passwordConfirm: '' })
    expect(Object.keys(errors).sort()).toEqual(['email', 'fullName', 'password', 'passwordConfirm'])
  })
})

describe('validateLoginForm', () => {
  it('пустые поля', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: MESSAGES.emailRequired,
      password: MESSAGES.passwordRequired,
    })
  })

  it('длину пароля при входе не проверяем', () => {
    expect(validateLoginForm({ email: 'user@mail.ru', password: '123' })).toEqual({})
  })
})
