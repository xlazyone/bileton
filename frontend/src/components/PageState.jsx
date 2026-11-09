// Общие состояния страниц с данными: загрузка, ошибка с повтором, пустой результат.

export function LoadingState({ text = 'Загрузка…' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="state__spinner" aria-hidden="true" />
      <p className="state__text">{text}</p>
    </div>
  )
}

/** Ошибка сети/сервера: сообщение и кнопка «Повторить» (US-01 DoD). */
export function ErrorState({ error, onRetry, title = 'Не удалось загрузить данные' }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">{title}</p>
      <p className="state__text">{error?.message || 'Проверьте подключение и повторите попытку.'}</p>
      <button type="button" className="button button--primary" onClick={onRetry}>
        Повторить
      </button>
    </div>
  )
}

/** Пустой результат — это не ошибка (US-04 DoD). */
export function EmptyState({ title, text, children }) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      {text && <p className="state__text">{text}</p>}
      {children}
    </div>
  )
}
