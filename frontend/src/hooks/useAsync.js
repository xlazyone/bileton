import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Загрузка данных со статусом и повтором.
 *
 *   const { status, data, error, retry } = useAsync(() => fetchMovies(), 'movies')
 *
 * status: 'loading' | 'success' | 'error'. При смене key запрос повторяется.
 */
export function useAsync(loader, key) {
  // Последняя версия loader — без неё эффект пришлось бы перезапускать на каждом рендере
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  })

  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', data: null, error: null, for: null })
  const requestId = `${key}#${attempt}`

  useEffect(() => {
    let cancelled = false
    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null, for: requestId })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error, for: requestId })
      })
    return () => {
      cancelled = true
    }
  }, [requestId]) // перезапуск только при смене key или по retry

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  // Пока ответ на текущий запрос не пришёл — показываем загрузку
  if (state.for !== requestId) return { status: 'loading', data: null, error: null, retry }
  return { status: state.status, data: state.data, error: state.error, retry }
}
