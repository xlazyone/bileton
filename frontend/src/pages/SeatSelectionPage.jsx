// Модуль «Схема зала и бронирование» (Спринт 3).
// 5.4 — схема зала: занятость с backend, занятые места не кликабельны, выбор одного места
//       снимает предыдущий выбор.
// 5.5 — отправка брони и обработка 409 «место уже занято».
// Свои брони (status «mine» от backend) видны и после возврата на страницу; можно
// забронировать ещё места на тот же сеанс (seat-reservation-logic.md, разделы 1 и 6).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createBooking, fetchSeatMap, isSeatConflict } from '../api/booking'
import Alert from '../components/Alert'
import { ErrorState, LoadingState } from '../components/PageState'
import SeatMap from '../components/SeatMap'
import { formatPrice } from '../utils/movies'
import { formatDateTime, formatTime } from '../utils/schedule'
import { countFree, markMine, markOccupied, myBookedSeats, seatLabel } from '../utils/seatMap'

const CONFLICT_HINT = 'Выберите другое место — схема зала обновлена.'

export default function SeatSelectionPage() {
  const { sessionId } = useParams()

  const [load, setLoad] = useState({ status: 'loading', seatMap: null, error: null })
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false) // защита от двойного клика до перерисовки
  const [justBooked, setJustBooked] = useState(null) // только что созданная бронь {seat, expiresAt}
  const [notice, setNotice] = useState(null) // {variant, text}
  const [conflictSeatId, setConflictSeatId] = useState(null)

  /** silent=true — обновить схему без экрана загрузки (после 409 и по кнопке). */
  const loadSeatMap = useCallback(
    async (silent = false) => {
      if (!silent) setLoad({ status: 'loading', seatMap: null, error: null })
      try {
        const seatMap = await fetchSeatMap(sessionId)
        setLoad({ status: 'ready', seatMap, error: null })
        return seatMap
      } catch (error) {
        if (!silent) setLoad({ status: 'error', seatMap: null, error })
        return null
      }
    },
    [sessionId],
  )

  useEffect(() => {
    let cancelled = false
    fetchSeatMap(sessionId)
      .then((seatMap) => {
        if (!cancelled) setLoad({ status: 'ready', seatMap, error: null })
      })
      .catch((error) => {
        if (!cancelled) setLoad({ status: 'error', seatMap: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  function handleSelect(seat) {
    if (submitting) return
    setNotice(null)
    setJustBooked(null)
    setConflictSeatId(null)
    // Повторный клик снимает выбор, клик по другому месту — заменяет его (5.4)
    setSelected((current) => (current?.id === seat.id ? null : seat))
  }

  async function handleBook() {
    if (!selected || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setNotice(null)
    try {
      const result = await createBooking(sessionId, selected.id)
      const seat = selected
      setJustBooked({ seat, expiresAt: result.expiresAt })
      setSelected(null)
      // Сразу показываем место своим, затем сверяем схему с backend (другие могли занять места)
      setLoad((current) => ({
        ...current,
        seatMap: markMine(current.seatMap, seat.id, result.expiresAt),
      }))
      loadSeatMap(true).then((fresh) => {
        if (fresh) {
          setLoad({ status: 'ready', seatMap: markMine(fresh, seat.id, result.expiresAt), error: null })
        }
      })
    } catch (error) {
      if (isSeatConflict(error)) {
        // 5.5: место успели занять — показываем, снимаем выбор, обновляем схему
        const seatId = Number(error.details?.seat_id ?? selected.id)
        setConflictSeatId(seatId)
        setSelected(null)
        setLoad((current) =>
          current.seatMap
            ? { ...current, seatMap: markOccupied(current.seatMap, [seatId]) }
            : current,
        )
        setNotice({ variant: 'error', text: `${error.message}. ${CONFLICT_HINT}` })
        loadSeatMap(true).then((fresh) => {
          if (fresh) setLoad({ status: 'ready', seatMap: markOccupied(fresh, [seatId]), error: null })
        })
      } else if (error.status === 401) {
        // Токен истёк: client.js уже вызвал выход, ProtectedRoute вернёт сюда после входа
        setNotice({ variant: 'error', text: 'Сессия истекла. Войдите снова, чтобы забронировать место.' })
      } else {
        // Сеть / 5xx / 404: выбор сохраняем, можно повторить
        setNotice({ variant: 'error', text: error.message || 'Не удалось забронировать место.' })
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (load.status === 'loading') {
    return (
      <section className="page">
        <LoadingState text="Загружаем схему зала…" />
      </section>
    )
  }

  if (load.status === 'error') {
    const notFound = load.error?.status === 404 || load.error?.status === 422
    return (
      <section className="page">
        <Link to="/" className="back-link">
          ← К афише
        </Link>
        {notFound ? (
          <div className="state state--empty">
            <p className="state__title">Сеанс не найден</p>
            <p className="state__text">Возможно, он уже прошёл или был отменён.</p>
          </div>
        ) : (
          <ErrorState error={load.error} onRetry={() => loadSeatMap()} />
        )}
      </section>
    )
  }

  const { seatMap } = load
  const freeCount = countFree(seatMap)
  const mySeats = myBookedSeats(seatMap)

  return (
    <section className="page booking">
      <Link to={`/movies/${encodeURIComponent(seatMap.movie.id)}`} className="back-link">
        ← К расписанию
      </Link>

      <header className="booking__header">
        <h1 className="page__title">Выбор мест</h1>
        <p className="booking__movie">
          {seatMap.movie.title}
          {seatMap.movie.ageRating && (
            <span className="age-badge age-badge--inline">{seatMap.movie.ageRating}</span>
          )}
        </p>
        <p className="booking__facts">
          {[formatDateTime(seatMap.startsAt), seatMap.hall.name, formatPrice(seatMap.price)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {notice && <Alert variant={notice.variant}>{notice.text}</Alert>}

      {justBooked && (
        <Alert variant="success">
          <strong>Место забронировано: {seatLabel(justBooked.seat)}.</strong>{' '}
          {justBooked.expiresAt
            ? `Бронь действует до ${formatTime(justBooked.expiresAt)} — оплатите билет до этого времени.`
            : 'Бронь сохранена.'}{' '}
          Оплата и QR-билет появятся в следующем спринте.
        </Alert>
      )}

      {mySeats.length > 0 && (
        <div className="my-bookings" aria-label="Ваши брони на этот сеанс">
          <p className="my-bookings__title">Ваши брони на этот сеанс</p>
          <ul className="my-bookings__list">
            {mySeats.map((seat) => (
              <li key={seat.id}>
                {seatLabel(seat)}
                <span className="my-bookings__until">
                  {seat.expiresAt ? `до ${formatTime(seat.expiresAt)}` : 'оплачено'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {freeCount === 0 && (
        <Alert variant="info">Свободных мест на этот сеанс не осталось.</Alert>
      )}

      <SeatMap
        seatMap={seatMap}
        selectedSeatId={selected?.id ?? null}
        conflictSeatId={conflictSeatId}
        disabled={submitting}
        onSelect={handleSelect}
      />

      <div className="booking__bar">
        <div className="booking__summary" aria-live="polite">
          {selected ? (
            <span>
              {seatLabel(selected)}
              {seatMap.price !== null && <strong> · {formatPrice(seatMap.price)}</strong>}
            </span>
          ) : (
            <span className="booking__hint">
              {mySeats.length > 0 ? 'Можно выбрать ещё место' : 'Выберите место на схеме'} · свободно{' '}
              {freeCount}
            </span>
          )}
        </div>
        <div className="booking__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => loadSeatMap(true)}
            disabled={submitting}
            title="Обновить схему зала"
          >
            Обновить
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleBook}
            disabled={!selected || submitting}
          >
            {submitting ? 'Бронируем…' : 'Забронировать'}
          </button>
        </div>
      </div>
    </section>
  )
}
