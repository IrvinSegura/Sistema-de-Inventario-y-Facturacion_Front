import { describe, expect, it } from 'vitest'

import { addDays, dayAfter, daysInRange, lastDayOfMonth, startOfDay, toDay, weekday } from './days'

describe('store days', () => {
  it('places an instant on its day in the store, not the browser', () => {
    // 05:30 UTC is still the previous evening in Mexico City (UTC−6).
    expect(toDay(new Date('2026-10-19T05:30:00Z'), 'America/Mexico_City')).toBe('2026-10-18')
    expect(toDay(new Date('2026-10-19T06:00:00Z'), 'America/Mexico_City')).toBe('2026-10-19')
  })

  it('starts a day at the store midnight', () => {
    expect(startOfDay('2026-10-19', 'America/Mexico_City')).toBe('2026-10-19T06:00:00.000Z')
    expect(dayAfter('2026-12-31', 'America/Mexico_City')).toBe('2027-01-01T06:00:00.000Z')
  })

  it('follows daylight saving changes', () => {
    // Tijuana moves to UTC−7 on 2026-03-08 at 02:00; that day still starts at UTC−8.
    expect(startOfDay('2026-03-08', 'America/Tijuana')).toBe('2026-03-08T08:00:00.000Z')
    expect(startOfDay('2026-03-09', 'America/Tijuana')).toBe('2026-03-09T07:00:00.000Z')
    expect(startOfDay('2026-11-02', 'America/Tijuana')).toBe('2026-11-02T08:00:00.000Z')
  })

  it('does calendar arithmetic without time zones', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29')
    expect(weekday('2026-10-19')).toBe(1)
    expect(daysInRange({ from: '2026-03-01', to: '2026-03-31' })).toBe(31)
  })
})
