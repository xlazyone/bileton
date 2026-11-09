import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { GuestOnlyRoute, ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './hooks/useAuth'
import ControllerPage from './pages/ControllerPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import { homePathForRole } from './utils/roles'

// Главная пока ведёт либо в раздел пользователя, либо на вход (афиша — спринт 2).
function HomeRedirect() {
  const { user, status } = useAuth()
  if (status === 'loading') return null
  return <Navigate to={user ? homePathForRole(user.role) : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeRedirect />} />
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
