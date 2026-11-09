// Клиентская валидация — те же правила, что в backend/app/schemas/user.py (UserCreate):
//   email — EmailStr, пароль 8..128 символов, password == password_confirm, full_name <= 255.
// Тексты сообщений — из docs/requirements/use-cases.md (UC-01 A1–A3, UC-02 A1).

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const FULL_NAME_MAX_LENGTH = 255

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

export const MESSAGES = {
  fullNameRequired: 'Введите имя',
  fullNameTooLong: `Имя должно содержать не более ${FULL_NAME_MAX_LENGTH} символов`,
  emailRequired: 'Введите email',
  emailInvalid: 'Введите корректный email',
  passwordRequired: 'Введите пароль',
  passwordTooShort: `Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов`,
  passwordTooLong: `Пароль должен содержать не более ${PASSWORD_MAX_LENGTH} символов`,
  passwordConfirmRequired: 'Повторите пароль',
  passwordsMismatch: 'Пароли не совпадают',
}

export function isValidEmail(value) {
  const email = value.trim()
  return EMAIL_RE.test(email) && !email.includes('..')
}

export function validateFullName(value) {
  const name = value.trim()
  if (!name) return MESSAGES.fullNameRequired
  if (name.length > FULL_NAME_MAX_LENGTH) return MESSAGES.fullNameTooLong
  return null
}

export function validateEmail(value) {
  if (!value.trim()) return MESSAGES.emailRequired
  if (!isValidEmail(value)) return MESSAGES.emailInvalid
  return null
}

// Пароль не обрезаем по пробелам: backend тоже считает их символами.
export function validatePassword(value) {
  if (!value) return MESSAGES.passwordRequired
  if (value.length < PASSWORD_MIN_LENGTH) return MESSAGES.passwordTooShort
  if (value.length > PASSWORD_MAX_LENGTH) return MESSAGES.passwordTooLong
  return null
}

export function validatePasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm) return MESSAGES.passwordConfirmRequired
  if (password !== passwordConfirm) return MESSAGES.passwordsMismatch
  return null
}

function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

/** Ошибки формы регистрации: { поле: сообщение }. Пустой объект — форма валидна. */
export function validateRegisterForm({ fullName, email, password, passwordConfirm }) {
  return compact({
    fullName: validateFullName(fullName),
    email: validateEmail(email),
    password: validatePassword(password),
    passwordConfirm: validatePasswordConfirm(password, passwordConfirm),
  })
}

/** Ошибки формы входа. Длину пароля здесь не проверяем — это не раскрывает правил. */
export function validateLoginForm({ email, password }) {
  return compact({
    email: validateEmail(email),
    password: password ? null : MESSAGES.passwordRequired,
  })
}
