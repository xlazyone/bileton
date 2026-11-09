import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { homePathForRole } from '../utils/roles'

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
 */
export function ProtectedRoute({ roles, children }) {
  const { user, status } = useAuth()

  if (status === 'loading') return <Loader />
  if (!user) return <Navigate to="/login" replace />
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

  if (status === 'loading') return <Loader />
  if (user) return <Navigate to={homePathForRole(user.role)} replace />
  return children
}
