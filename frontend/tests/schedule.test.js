// Группировка и сортировка расписания (US-02 DoD).

import { describe, expect, it } from 'vitest'
import { dateKey, dayLabel, groupSessionsByDay } from '../src/utils/schedule'

// «Сейчас» — понедельник 9 ноября 2026, 15:00 по локальному времени
const NOW = new Date(2026, 10, 9, 15, 0)

function at(dayOffset, hours, minutes = 0, id = `${dayOffset}-${hours}-${minutes}`) {
  return { id, startsAt: new Date(2026, 10, 9 + dayOffset, hours, minutes) }
}

describe('dayLabel', () => {
  it('сегодня, завтра и день недели', () => {
    expect(dayLabel(at(0, 18).startsAt, NOW)).toBe('Сегодня, 9 ноября')
    expect(dayLabel(at(1, 10).startsAt, NOW)).toBe('Завтра, 10 ноября')
    expect(dayLabel(at(2, 10).startsAt, NOW)).toBe('Среда, 11 ноября')
  })

  it('переход через конец месяца', () => {
    const now = new Date(2026, 10, 30, 12, 0)
    expect(dayLabel(new Date(2026, 11, 1, 10, 0), now)).toBe('Завтра, 1 декабря')
  })
})

describe('groupSessionsByDay', () => {
  it('группы по датам по возрастанию, внутри — по времени', () => {
    const sessions = [at(2, 11), at(0, 21), at(1, 9), at(0, 17, 30), at(1, 23)]
    const { groups } = groupSessionsByDay(sessions, NOW)

    expect(groups.map((group) => group.label)).toEqual([
      'Сегодня, 9 ноября',
      'Завтра, 10 ноября',
      'Среда, 11 ноября',
    ])
    expect(groups[0].sessions.map((session) => session.id)).toEqual(['0-17-30', '0-21-0'])
    expect(groups[1].sessions.map((session) => session.id)).toEqual(['1-9-0', '1-23-0'])
    expect(groups.map((group) => group.key)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
  })

  it('начавшиеся сегодня сеансы видны, но недоступны', () => {
    const { groups, upcomingCount } = groupSessionsByDay([at(0, 10), at(0, 15), at(0, 19)], NOW)

    expect(groups[0].sessions.map((session) => session.isPast)).toEqual([true, true, false])
    expect(upcomingCount).toBe(1)
  })

  it('сеансы прошлых дней не показываются', () => {
    const { groups } = groupSessionsByDay([at(-1, 20), at(1, 10)], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Завтра, 10 ноября')
  })

  it('US-04: пустой массив — нет групп и нет доступных сеансов', () => {
    expect(groupSessionsByDay([], NOW)).toEqual({ groups: [], upcomingCount: 0 })
  })

  it('только прошедшие сеансы — доступных нет', () => {
    expect(groupSessionsByDay([at(0, 9), at(-2, 20)], NOW).upcomingCount).toBe(0)
  })

  it('сеанс с некорректной датой пропускается', () => {
    const broken = { id: 'x', startsAt: new Date('не дата') }
    expect(groupSessionsByDay([broken, at(1, 10)], NOW).groups[0].sessions).toHaveLength(1)
  })

  it('не меняет исходный массив', () => {
    const sessions = [at(1, 12), at(1, 10)]
    groupSessionsByDay(sessions, NOW)
    expect(sessions.map((session) => session.id)).toEqual(['1-12-0', '1-10-0'])
  })
})

describe('dateKey', () => {
  it('локальная дата с ведущими нулями', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
