// Роли из backend/app/models/user.py (UserRole) и куда вести пользователя после входа (UC-02 шаг 6).

export const ROLE_LABELS = {
  viewer: 'Зритель',
  controller: 'Контроллер',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? role
}

export function homePathForRole(role) {
  return role === 'controller' ? '/controller' : '/profile'
}
