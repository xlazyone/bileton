// Общий каркас страниц входа и регистрации: слева — бренд-панель со «схемой зала», справа — форма.

// Детерминированный рисунок мест: 0 — свободно, 1 — занято, 2 — выбрано
const SEAT_ROWS = [
  [0, 0, 1, 1, 0, 0, 0, 1],
  [0, 1, 1, 0, 0, 2, 2, 0],
  [1, 1, 0, 0, 0, 0, 1, 1],
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
]
const SEAT_CLASS = ['seat', 'seat seat--taken', 'seat seat--selected']

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <aside className="auth__brand" aria-hidden="true">
        <div className="screen" />
        <div className="seats">
          {SEAT_ROWS.map((row, rowIndex) =>
            row.map((state, seatIndex) => (
              <span key={`${rowIndex}-${seatIndex}`} className={SEAT_CLASS[state]} />
            )),
          )}
        </div>
        <p className="auth__tagline">
          Выберите место на схеме зала —<br />
          билет придёт QR-кодом.
        </p>
      </aside>

      <section className="auth__card">
        <h1 className="auth__title">{title}</h1>
        {subtitle && <p className="auth__subtitle">{subtitle}</p>}
        {children}
      </section>
    </div>
  )
}
