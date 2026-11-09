// Заглушка панели контроллера: нужна сейчас для редиректа по роли (UC-02 шаг 6)
// и проверки разграничения доступа (UC-04). Сама страница — пакет 7.3.1.

import { useAuth } from '../hooks/useAuth'

export default function ControllerPage() {
  const { user } = useAuth()

  return (
    <section className="panel">
      <h1 className="panel__title">Панель контроллера</h1>
      <p className="panel__text">Вы вошли как {user.full_name || user.email}.</p>
      <p className="panel__note">Проверка QR-кодов билетов появится в модуле «Панель контроллера».</p>
    </section>
  )
}
