// Личный кабинет зрителя — пока только профиль из GET /api/auth/me.
// Билеты и история заказов появятся в пакете 6.3.1.

import { useAuth } from '../hooks/useAuth'
import { roleLabel } from '../utils/roles'

function formatDate(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <section className="panel">
      <h1 className="panel__title">Личный кабинет</h1>
      <p className="panel__text">Добро пожаловать{user.full_name ? `, ${user.full_name}` : ''}!</p>

      <dl className="profile">
        <div className="profile__row">
          <dt>Имя</dt>
          <dd>{user.full_name || '—'}</dd>
        </div>
        <div className="profile__row">
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="profile__row">
          <dt>Роль</dt>
          <dd>{roleLabel(user.role)}</dd>
        </div>
        <div className="profile__row">
          <dt>Аккаунт создан</dt>
          <dd>{formatDate(user.created_at)}</dd>
        </div>
      </dl>

      <p className="panel__note">Афиша и ваши билеты появятся в следующих спринтах.</p>
    </section>
  )
}
