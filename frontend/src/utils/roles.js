// Роли из backend/app/models/user.py (UserRole) и куда вести пользователя после входа (UC-02 шаг 6).

export const ROLE_LABELS = {
  viewer: 'Зритель',
  controller: 'Контроллер',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role
}

// UC-02 шаг 6: viewer -> афиша, controller -> панель контроллера
export function homePathForRole(role) {
  return role === 'controller' ? '/controller' : '/'
}

/**
 * Куда вести после входа. Если пользователя отправили на вход с защищённой страницы
 * (например, выбор мест на сеанс — US-05), возвращаем его туда же вместе с состоянием.
 * @returns {{ to: string, state: unknown }}
 */
export function redirectAfterLogin(location, role) {
  const from = location?.state?.from
  if (from?.pathname && from.pathname !== '/login' && from.pathname !== '/register') {
    return { to: `${from.pathname}${from.search ?? ''}`, state: from.state ?? null }
  }
  return { to: homePathForRole(role), state: null }
}
