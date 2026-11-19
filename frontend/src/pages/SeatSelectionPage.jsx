// Точка входа в модуль «Бронирование мест» (5.0, спринт 3).
// Здесь уже есть session_id из адреса (US-05); схема зала появится в задаче 5.4.

import { Link, useLocation, useParams } from 'react-router-dom'
import { formatPrice } from '../utils/movies'
import { formatDateTime } from '../utils/schedule'

export default function SeatSelectionPage() {
  const { sessionId } = useParams()
  const { state } = useLocation()
  const session = state?.session ?? null
  const movie = state?.movie ?? null
  const startsAt = session ? new Date(session.startsAt) : null

  return (
    <section className="panel">
      <h1 className="panel__title">Выбор мест</h1>
      <p className="panel__text">
        {movie ? <strong>{movie.title}</strong> : `Сеанс № ${sessionId}`}
      </p>

      {session && (
        <dl className="profile">
          <div className="profile__row">
            <dt>Начало</dt>
            <dd>{formatDateTime(startsAt)}</dd>
          </div>
          {session.hallName && (
            <div className="profile__row">
              <dt>Зал</dt>
              <dd>{session.hallName}</dd>
            </div>
          )}
          {session.price !== null && (
            <div className="profile__row">
              <dt>Цена билета</dt>
              <dd>{formatPrice(session.price)}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="panel__note" data-session-id={sessionId}>
        Схема зала и выбор мест появятся в модуле «Бронирование мест» (спринт 3).
      </p>
      <p className="panel__note">
        <Link to={movie ? `/movies/${encodeURIComponent(movie.id)}` : '/'}>
          ← {movie ? 'К расписанию' : 'К афише'}
        </Link>
      </p>
    </section>
  )
}
