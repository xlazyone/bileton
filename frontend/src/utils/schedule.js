// Расписание фильма: группировка сеансов по дням и сортировка (US-02 DoD).
//
// - Группы по локальной дате: «Сегодня», «Завтра», далее — день недели.
// - Внутри группы — по времени начала по возрастанию.
// - Уже начавшиеся сеансы сегодняшнего дня показываются, но недоступны (isPast);
//   прошедшие сеансы более ранних дней не показываются вовсе.

const dayMonthFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' })
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** Ключ локальной даты: 2026-11-09. */
export function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «Сегодня, 9 ноября» / «Завтра, 10 ноября» / «Среда, 11 ноября». */
export function dayLabel(date, now = new Date()) {
  const key = dateKey(date)
  const dayMonth = dayMonthFormatter.format(date)
  if (key === dateKey(now)) return `Сегодня, ${dayMonth}`
  if (key === dateKey(addDays(now, 1))) return `Завтра, ${dayMonth}`
  return `${capitalize(weekdayFormatter.format(date))}, ${dayMonth}`
}

/** «09:30». */
export function formatTime(date) {
  return timeFormatter.format(date)
}

/** «Среда, 11 ноября, 19:30» — для страницы выбора мест. */
export function formatDateTime(date, now = new Date()) {
  return `${dayLabel(date, now)}, ${formatTime(date)}`
}

/**
 * @param {Array<{ startsAt: Date }>} sessions нормализованные сеансы
 * @param {Date} now
 * @returns {{ groups: Array<{ key: string, label: string, sessions: Array }>, upcomingCount: number }}
 *   каждый сеанс в группах дополнен полем isPast
 */
export function groupSessionsByDay(sessions, now = new Date()) {
  const todayKey = dateKey(now)
  const visible = sessions
    .filter((session) => !Number.isNaN(session.startsAt.getTime()))
    .map((session) => ({ ...session, isPast: session.startsAt <= now }))
    .filter((session) => !session.isPast || dateKey(session.startsAt) === todayKey)
    .sort((a, b) => a.startsAt - b.startsAt)

  const groups = []
  for (const session of visible) {
    const key = dateKey(session.startsAt)
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(session.startsAt, now), sessions: [] }
      groups.push(group)
    }
    group.sessions.push(session)
  }

  const upcomingCount = visible.filter((session) => !session.isPast).length
  return { groups, upcomingCount }
}
