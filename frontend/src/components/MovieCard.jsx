// Карточка фильма в афише (US-01): постер, название, жанры, длительность, возрастной рейтинг.
// Вся карточка — ссылка на расписание фильма (US-02).

import { Link } from 'react-router-dom'
import { formatDuration, formatGenres } from '../utils/movies'
import Poster from './Poster'

export default function MovieCard({ movie }) {
  const duration = formatDuration(movie.durationMinutes)

  return (
    <article className="movie-card">
      <Link
        to={`/movies/${encodeURIComponent(movie.id)}`}
        className="movie-card__link"
        aria-label={`${movie.title} — расписание сеансов`}
      >
        <div className="movie-card__poster">
          <Poster movie={movie} />
          {movie.ageRating && (
            <span className="age-badge" title="Возрастной рейтинг">
              {movie.ageRating}
            </span>
          )}
        </div>
        <div className="movie-card__body">
          <h2 className="movie-card__title">{movie.title}</h2>
          {movie.genres.length > 0 && (
            <p className="movie-card__genres">{formatGenres(movie.genres)}</p>
          )}
          {duration && <p className="movie-card__duration">{duration}</p>}
        </div>
      </Link>
    </article>
  )
}
