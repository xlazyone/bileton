import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { GuestOnlyRoute, ProtectedRoute } from './components/ProtectedRoute'
import ControllerPage from './pages/ControllerPage'
import LoginPage from './pages/LoginPage'
import MoviesPage from './pages/MoviesPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import SchedulePage from './pages/SchedulePage'
import SeatSelectionPage from './pages/SeatSelectionPage'

export const LOGIN_TO_BOOK_MESSAGE = 'Чтобы выбрать места, войдите или зарегистрируйтесь.'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Спринт 2: афиша и расписание доступны без авторизации (US-01, US-02) */}
        <Route index element={<MoviesPage />} />
        <Route path="movies/:movieId" element={<SchedulePage />} />
        <Route
          path="sessions/:sessionId/seats"
          element={
            <ProtectedRoute reason={LOGIN_TO_BOOK_MESSAGE}>
              <SeatSelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="login"
          element={
            <GuestOnlyRoute>
              <LoginPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="register"
          element={
            <GuestOnlyRoute>
              <RegisterPage />
            </GuestOnlyRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="controller"
          element={
            <ProtectedRoute roles={['controller']}>
              <ControllerPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
