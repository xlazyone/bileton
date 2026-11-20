// Интерактивная схема зала (WBS 5.4): CSS Grid «ряды × места», статусы свободно / занято / выбрано.

import { buildSeatRows, seatLabel, SEAT_STATUS } from '../utils/seatMap'

const STATUS_TEXT = {
  free: 'свободно',
  occupied: 'занято',
  selected: 'выбрано',
  mine: 'ваша бронь',
}

function seatState(seat, { selectedSeatId, conflictSeatId }) {
  if (seat.status === SEAT_STATUS.MINE) return 'mine'
  if (seat.id === selectedSeatId) return 'selected'
  if (seat.id === conflictSeatId || seat.status !== SEAT_STATUS.FREE) return 'occupied'
  return 'free'
}

export default function SeatMap({
  seatMap,
  selectedSeatId = null,
  conflictSeatId = null,
  disabled = false,
  onSelect,
}) {
  const rows = buildSeatRows(seatMap)
  const columns = seatMap.hall.seatsPerRow
  const hasMine = seatMap.seats.some((seat) => seat.status === SEAT_STATUS.MINE)

  return (
    <div className="hall">
      <div className="hall__screen" aria-hidden="true">
        <span>Экран</span>
      </div>

      <div className="hall__scroll">
        <div
          className="hall__grid"
          role="group"
          aria-label={`Схема зала «${seatMap.hall.name}»`}
          style={{ '--seat-columns': columns }}
        >
          {rows.map(({ row, cells }) => (
            <div key={row} className="hall__row" role="group" aria-label={`Ряд ${row}`}>
              <span className="hall__row-label" aria-hidden="true">
                {row}
              </span>
              {cells.map((seat, index) => {
                if (!seat) return <span key={`gap-${index}`} className="seat seat--gap" />
                const state = seatState(seat, { selectedSeatId, conflictSeatId })
                const unavailable = state === 'occupied' || state === 'mine'
                return (
                  <button
                    key={seat.id}
                    type="button"
                    className={[
                      'seat',
                      `seat--${state}`,
                      seat.id === conflictSeatId ? 'seat--conflict' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={unavailable || disabled}
                    aria-pressed={state === 'selected'}
                    aria-label={`${seatLabel(seat)}, ${STATUS_TEXT[state]}`}
                    title={`${seatLabel(seat)} — ${STATUS_TEXT[state]}`}
                    onClick={() => onSelect(seat)}
                  >
                    <span className="seat__number" aria-hidden="true">
                      {seat.number}
                    </span>
                  </button>
                )
              })}
              <span className="hall__row-label" aria-hidden="true">
                {row}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ul className="legend" aria-label="Обозначения">
        <li>
          <span className="seat seat--free seat--sample" aria-hidden="true" /> Свободно
        </li>
        <li>
          <span className="seat seat--selected seat--sample" aria-hidden="true" /> Выбрано
        </li>
        <li>
          <span className="seat seat--occupied seat--sample" aria-hidden="true" /> Занято
        </li>
        {hasMine && (
          <li>
            <span className="seat seat--mine seat--sample" aria-hidden="true" /> Ваша бронь
          </li>
        )}
      </ul>
    </div>
  )
}
