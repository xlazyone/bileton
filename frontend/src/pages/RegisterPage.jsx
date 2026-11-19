// UC-01 «Регистрация нового пользователя» (WBS 3.3.1 верстка, 3.3.2 интеграция с API)

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../api/auth'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { useForm } from '../hooks/useForm'
import { PASSWORD_MIN_LENGTH, validateRegisterForm } from '../utils/validation'

const INITIAL_VALUES = { fullName: '', email: '', password: '', passwordConfirm: '' }

export default function RegisterPage() {
  const navigate = useNavigate()
  const { values, errors, isValid, handleChange, handleBlur, touchAll, setServerErrors } = useForm(
    INITIAL_VALUES,
    validateRegisterForm,
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null) // { text, suggestLogin }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    touchAll()
    if (!isValid || submitting) return // A1–A3: форма не отправляется

    setSubmitting(true)
    try {
      await registerUser(values)
      // Регистрация не возвращает токен -> отправляем на вход (UC-01 шаг 7–8)
      navigate('/login', { state: { registeredEmail: values.email.trim() } })
    } catch (error) {
      if (error.status === 409) {
        // A4: email занят -> предлагаем войти
        setFormError({ text: 'Пользователь с таким email уже существует.', suggestLogin: true })
      } else if (error.status === 422) {
        setServerErrors(error.fieldErrors ?? {})
        setFormError({ text: 'Проверьте правильность заполнения полей.' })
      } else {
        // A5: ошибка сервера/сети — данные формы остаются, можно повторить
        setFormError({ text: error.message || 'Не удалось зарегистрироваться. Повторите попытку.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Регистрация" subtitle="Создайте аккаунт, чтобы покупать билеты онлайн.">
      {formError && (
        <Alert>
          {formError.text}{' '}
          {formError.suggestLogin && <Link to="/login">Перейти ко входу</Link>}
        </Alert>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="fullName"
          label="Имя"
          value={values.fullName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.fullName}
          autoComplete="name"
          autoFocus
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.email}
          autoComplete="email"
        />
        <FormField
          id="password"
          label="Пароль"
          type="password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.password}
          hint={`Не менее ${PASSWORD_MIN_LENGTH} символов`}
          autoComplete="new-password"
        />
        <FormField
          id="passwordConfirm"
          label="Подтверждение пароля"
          type="password"
          value={values.passwordConfirm}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.passwordConfirm}
          autoComplete="new-password"
        />

        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Регистрируем…' : 'Зарегистрироваться'}
        </button>
      </form>

      <p className="auth__switch">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </AuthLayout>
  )
}
