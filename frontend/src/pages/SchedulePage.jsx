// US-02 «Просмотр расписания», US-03 «Информативность карточки сеанса»,
// US-04 «Обработка пустого расписания», US-05 «Переход к покупке билета».

import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchMovie, fetchSessions } from '../api/movies'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import Poster from '../components/Poster'
import { useAsync } from '../hooks/useAsync'
import { formatDuration, formatGenres, formatPrice } from '../utils/movies'
import { formatTime, groupSessionsByDay } from '../utils/schedule'

function BackLink() {
  return (
    <Link to="/" className="back-link">
      ← К афише
    </Link>
  )
}

async function loadSchedule(movieId) {
  // Фильм и сеансы грузим параллельно; зал и цена приходят в самих сеансах (US-03)
  const [movie, sessions] = await Promise.all([fetchMovie(movieId), fetchSessions(movieId)])
  // Группируем здесь, а не при рендере: «сейчас» фиксируется в момент загрузки
  return { movie, schedule: groupSessionsByDay(sessions, new Date()) }
}

export default function SchedulePage() {
  const { movieId } = useParams()
  const navigate = useNavigate()
  const { status, data, error, retry } = useAsync(() => loadSchedule(movieId), `schedule:${movieId}`)

  function openSession(session) {
    // session_id уходит в модуль бронирования (5.0) через адрес страницы.
    // Гостя ProtectedRoute отправит на вход и вернёт сюда же после авторизации (US-05).
    navigate(`/sessions/${encodeURIComponent(session.id)}/seats`, {
      state: {
        session: { ...session, startsAt: session.startsAt.toISOString() },
        movie: { id: data.movie.id, title: data.movie.title },
      },
    })
  }

  if (status === 'loading') {
    return (
      <section className="page">
        <BackLink />
        <LoadingState text="Загружаем расписание…" />
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="page">
        <BackLink />
        <ErrorState error={error} onRetry={retry} />
      </section>
    )
  }

  const { movie, schedule } = data
  if (!movie) {
    return (
      <section className="page">
        <BackLink />
        <EmptyState title="Фильм не найден" text="Возможно, он уже сошёл с экранов." />
      </section>
    )
  }

  const duration = formatDuration(movie.durationMinutes)
  const facts = [formatGenres(movie.genres), duration].filter(Boolean)

  return (
    <section className="page">
      <BackLink />

      <header className="movie-header">
        <Poster movie={movie} className="movie-header__poster" />
        <div className="movie-header__info">
          <h1 className="page__title">{movie.title}</h1>
          {facts.length > 0 && <p className="movie-header__facts">{facts.join(' · ')}</p>}
          {movie.ageRating && <span className="age-badge age-badge--inline">{movie.ageRating}</span>}
          {movie.description && <p className="movie-header__description">{movie.description}</p>}
        </div>
      </header>

      <h2 className="section-title">Расписание</h2>

      {schedule.upcomingCount === 0 ? (
        <EmptyState
          title="На этот фильм пока нет сеансов"
          text="Расписание обновляется — загляните позже или выберите другой фильм."
        >
          <Link to="/" className="button button--ghost">
            Выбрать другой фильм
          </Link>
        </EmptyState>
      ) : (
        <div className="schedule">
          {schedule.groups.map((group) => (
            <section key={group.key} className="schedule__day" aria-label={group.label}>
              <h3 className="schedule__date">{group.label}</h3>
              <ul className="session-list">
                {group.sessions.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      className="session"
                      disabled={session.isPast}
                      onClick={() => openSession(session)}
                      aria-label={[
                        formatTime(session.startsAt),
                        session.hallName,
                        formatPrice(session.price),
                        session.isPast ? 'сеанс уже начался' : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    >
                      <span className="session__time">{formatTime(session.startsAt)}</span>
                      {session.hallName && <span className="session__hall">{session.hallName}</span>}
                      {session.price !== null && (
                        <span className="session__price">{formatPrice(session.price)}</span>
                      )}
                      {session.isPast && <span className="session__past">Начался</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
