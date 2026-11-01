import { Link, Outlet, useNavigate } from 'react-router-dom'
import { USE_MOCKS } from '../config'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo" aria-label="БилетON — на главную">
          Билет<span className="logo__accent">ON</span>
        </Link>

        <div className="header__right">
          {USE_MOCKS && (
            <span className="badge" title="Ответы API подменяются мок-сервером (src/api/mockServer.js)">
              Демо-режим
            </span>
          )}
          {user && (
            <>
              <span className="header__user">{user.full_name || user.email}</span>
              <button type="button" className="button button--ghost" onClick={handleLogout}>
                Выйти
              </button>
            </>
          )}
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
