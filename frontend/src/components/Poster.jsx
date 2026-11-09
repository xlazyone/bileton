import { useState } from 'react'

// Тёплые «киношные» пары цветов для заглушки постера — выбираются по id фильма
const PALETTES = [
  ['#3b1d2e', '#b4233c'],
  ['#1d2b3b', '#3f7cac'],
  ['#2d2a1a', '#c8912b'],
  ['#1f2f27', '#3d8b63'],
  ['#2b1f3b', '#7a4fb4'],
  ['#3b2a1d', '#c0623a'],
]

function paletteFor(id) {
  const index = [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTES.length
  return PALETTES[index]
}

/**
 * Постер фильма. Если poster_url нет или картинка не загрузилась —
 * рисуем заглушку с названием, чтобы карточка не ломалась.
 */
export default function Poster({ movie, className = '' }) {
  const [failed, setFailed] = useState(false)
  const showImage = movie.posterUrl && !failed

  if (showImage) {
    return (
      <img
        className={`poster ${className}`}
        src={movie.posterUrl}
        alt={`Постер фильма «${movie.title}»`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }

  const [from, to] = paletteFor(movie.id)
  return (
    <div
      className={`poster poster--placeholder ${className}`}
      style={{ background: `linear-gradient(160deg, ${to} 0%, ${from} 75%)` }}
      role="img"
      aria-label={`Постер фильма «${movie.title}»`}
    >
      <span className="poster__title">{movie.title}</span>
    </div>
  )
}
