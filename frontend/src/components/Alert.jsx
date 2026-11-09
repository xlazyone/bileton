// Сообщение над формой: error — ошибка сервера/сети, success — успешное действие.
export default function Alert({ variant = 'error', children }) {
  return (
    <div className={`alert alert--${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
