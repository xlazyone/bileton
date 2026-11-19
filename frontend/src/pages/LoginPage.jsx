// UC-02 «Вход в систему» (WBS 3.3.1 верстка, 3.3.2 интеграция с API)

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { useAuth } from '../hooks/useAuth'
import { useForm } from '../hooks/useForm'
import { homePathForRole } from '../utils/roles'
import { validateLoginForm } from '../utils/validation'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const registeredEmail = location.state?.registeredEmail ?? ''

  const { values, errors, isValid, handleChange, handleBlur, touchAll } = useForm(
    { email: registeredEmail, password: '' },
    validateLoginForm,
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  // DoD 3.2: кнопка блокируется при пустых полях
  const hasEmptyFields = !values.email.trim() || !values.password

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError(null)
    touchAll()
    if (!isValid || submitting) return

    setSubmitting(true)
    try {
      const user = await login(values.email, values.password)
      // UC-02 шаг 6: viewer -> личный кабинет, controller -> панель контроллера
      navigate(homePathForRole(user.role), { replace: true })
    } catch (error) {
      if (error.status === 401) {
        setFormError('Неверный email или пароль') // A2: без уточнения, что именно неверно
      } else {
        setFormError(error.message || 'Не удалось войти. Повторите попытку.') // A3
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Вход" subtitle="Войдите, чтобы выбрать места и получить билеты.">
      {registeredEmail && !formError && (
        <Alert variant="success">Регистрация прошла успешно. Войдите с вашим паролем.</Alert>
      )}
      {formError && <Alert>{formError}</Alert>}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.email}
          autoComplete="email"
          autoFocus={!registeredEmail}
        />
        <FormField
          id="password"
          label="Пароль"
          type="password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.password}
          autoComplete="current-password"
          autoFocus={Boolean(registeredEmail)}
        />

        <button
          type="submit"
          className="button button--primary"
          disabled={hasEmptyFields || submitting}
        >
          {submitting ? 'Входим…' : 'Войти'}
        </button>
      </form>

      <p className="auth__switch">
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </AuthLayout>
  )
}
