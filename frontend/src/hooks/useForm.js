import { useState } from 'react'

/**
 * Состояние формы с клиентской валидацией.
 * Ошибка поля показывается после того, как пользователь заполнил поле и ушёл с него (blur)
 * или нажал «Отправить».
 * Ошибки от сервера (422) показываются, пока поле не изменят.
 */
export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrors] = useState({})

  const clientErrors = validate(values)
  const isValid = Object.keys(clientErrors).length === 0

  const errors = {}
  for (const field of Object.keys(initialValues)) {
    if (touched[field] && clientErrors[field]) errors[field] = clientErrors[field]
    else if (serverErrors[field]) errors[field] = serverErrors[field]
  }

  function handleChange(event) {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    setServerErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  // На blur проверяем только заполненное поле: «Введите …» для пустых полей
  // показываем при отправке формы, а не когда пользователь просто прошёл мимо.
  function handleBlur(event) {
    const { name, value } = event.target
    if (value === '') return
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  function touchAll() {
    setTouched(Object.fromEntries(Object.keys(initialValues).map((field) => [field, true])))
  }

  return { values, errors, isValid, handleChange, handleBlur, touchAll, setServerErrors }
}
