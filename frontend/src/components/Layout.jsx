import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { USE_CINEMA_MOCKS, USE_MOCKS } from '../config'
import { useAuth } from '../hooks/useAuth'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onAuthPage = pathname === '/login' || pathname === '/register'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__left">
          <Link to="/" className="logo" aria-label="БилетON — на главную">
            Билет<span className="logo__accent">ON</span>
          </Link>
          <nav className="nav" aria-label="Основное меню">
            <NavLink to="/" end className="nav__link">
              Афиша
            </NavLink>
          </nav>
        </div>

        <div className="header__right">
          {USE_MOCKS ? (
            <span className="badge" title="Ответы API подменяются мок-серверами (src/api/mockServer.js, mockCinema.js)">
              Демо-режим
            </span>
          ) : (
            USE_CINEMA_MOCKS && (
              <span className="badge" title="Афиша и сеансы — мок-данные (src/api/mockCinema.js), авторизация — реальный API">
                Демо-афиша
              </span>
            )
          )}
          {!user && !onAuthPage && (
            <Link to="/login" className="button button--ghost">
              Войти
            </Link>
          )}
          {user && (
            <>
              <Link to={user.role === 'controller' ? '/controller' : '/profile'} className="header__user">
                {user.full_name || user.email}
              </Link>
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
