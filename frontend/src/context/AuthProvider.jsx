import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCurrentUser, loginUser } from '../api/auth'
import { UNAUTHORIZED_EVENT } from '../api/client'
import { clearToken, getToken, setToken } from '../utils/tokenStorage'
import { AuthContext } from './authContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Если токен уже сохранён — сначала проверяем его через /me, иначе сразу гость.
  const [status, setStatus] = useState(() => (getToken() ? 'loading' : 'guest'))

  useEffect(() => {
    if (!getToken()) return undefined
    let cancelled = false

    fetchCurrentUser()
      .then((currentUser) => {
        if (cancelled) return
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch((error) => {
        if (cancelled) return
        // UC-03 A1: токен истёк / невалиден -> очищаем его
        if (error?.status === 401) clearToken()
        setUser(null)
        setStatus('guest')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Любой запрос с токеном получил 401 -> пользователь становится гостем,
  // ProtectedRoute сам отправит его на страницу входа (UC-03 A1, SEC-SESS-03)
  useEffect(() => {
    function onUnauthorized() {
      setUser(null)
      setStatus('guest')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(async (email, password) => {
    const token = await loginUser({ email, password })
    setToken(token)
    try {
      const currentUser = await fetchCurrentUser()
      setUser(currentUser)
      setStatus('authenticated')
      return currentUser
    } catch (error) {
      clearToken()
      throw error
    }
  }, [])

  // UC-03: выход — удаляем токен на клиенте
  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('guest')
  }, [])

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
