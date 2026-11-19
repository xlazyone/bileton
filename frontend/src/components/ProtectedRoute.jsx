import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { redirectAfterLogin } from '../utils/roles'

function Loader() {
  return (
    <div className="page-loader" role="status">
      Загрузка…
    </div>
  )
}

/**
 * Страница только для авторизованных (UC-04).
 * Нет токена -> редирект на вход (A1); роль не подходит -> «Доступ запрещён» (A2).
 * На вход передаём, откуда пришли (from) и зачем (reason) — после входа вернём обратно (US-05).
 */
export function ProtectedRoute({ roles, reason, children }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loader />
  if (!user) {
    // После явного «Выйти» возвращать на ту же страницу не нужно
    if (status === 'loggedOut') return <Navigate to="/login" replace />
    return <Navigate to="/login" replace state={{ from: location, reason }} />
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <section className="panel">
        <h1 className="panel__title">Доступ запрещён</h1>
        <p className="panel__text">У вашей роли нет доступа к этому разделу.</p>
      </section>
    )
  }
  return children
}

/** Страницы входа и регистрации: авторизованного пользователя отправляем в его раздел. */
export function GuestOnlyRoute({ children }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loader />
  if (user) {
    const { to, state } = redirectAfterLogin(location, user.role)
    return <Navigate to={to} state={state} replace />
  }
  return children
}
