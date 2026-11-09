export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  hint,
  autoComplete,
  autoFocus = false,
}) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={error ? 'field__input field__input--invalid' : 'field__input'}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
      />
      {/* Строка под сообщение есть всегда, чтобы форма не «прыгала» при появлении ошибки */}
      <p
        id={error ? errorId : hintId}
        className={error ? 'field__message field__message--error' : 'field__message'}
      >
        {error || hint || ''}
      </p>
    </div>
  )
}
