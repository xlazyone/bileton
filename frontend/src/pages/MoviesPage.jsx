// US-01 «Просмотр афиши» (WBS 4.4 верстка, 4.5 интеграция). Доступна без авторизации.

import { fetchMovies } from '../api/movies'
import MovieCard from '../components/MovieCard'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { useAsync } from '../hooks/useAsync'

export default function MoviesPage() {
  const { status, data: movies, error, retry } = useAsync(fetchMovies, 'movies')

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Афиша</h1>
        <p className="page__subtitle">Выберите фильм, чтобы посмотреть расписание сеансов.</p>
      </header>

      {status === 'loading' && <LoadingState text="Загружаем афишу…" />}
      {status === 'error' && <ErrorState error={error} onRetry={retry} />}
      {status === 'success' && movies.length === 0 && (
        <EmptyState title="Афиша пока пуста" text="Новые фильмы скоро появятся — загляните позже." />
      )}
      {status === 'success' && movies.length > 0 && (
        <ul className="movie-grid" aria-label="Фильмы в прокате">
          {movies.map((movie) => (
            <li key={movie.id}>
              <MovieCard movie={movie} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
