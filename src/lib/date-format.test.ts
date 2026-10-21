import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDate, formatDateTime, formatDay, formatDayRange, formatStoreDate, formatTime } from './date-format'

// Intl separates "p.m." with a narrow no-break space; plain spaces keep the expectations readable.
const plain = (text: string) => text.replace(/\s/g, ' ')
// 23:15 on Oct 19 in Mexico City (UTC−6), already Oct 20 in UTC.
const LATE_EVENING = '2026-10-20T05:15:00Z'

afterEach(() => {
  vi.unstubAllEnvs()
})

// A machine zone no store is in, so the browser's clock can't pass for the store's.
function inTokyo() {
  vi.stubEnv('TZ', 'Asia/Tokyo')
}

describe('formatTime', () => {
  it("shows the zone's wall clock, not UTC", () => {
    expect(plain(formatTime(LATE_EVENING, 'es', 'America/Mexico_City'))).toBe('11:15 p.m.')
    expect(plain(formatTime(LATE_EVENING, 'en', 'America/Mexico_City'))).toBe('11:15 PM')
  })

  it('follows the zone it is given', () => {
    expect(plain(formatTime(LATE_EVENING, 'en', 'America/Tijuana'))).toBe('10:15 PM')
    expect(plain(formatTime(LATE_EVENING, 'en', 'UTC'))).toBe('05:15 AM')
  })

  it("defaults to the store's clock, not the machine's", () => {
    inTokyo()

    expect(formatTime(LATE_EVENING, 'en')).not.toBe(formatTime(LATE_EVENING, 'en', 'Asia/Tokyo'))
  })

  it('shows a dash for a missing or malformed instant', () => {
    expect(formatTime(undefined, 'es')).toBe('—')
    // new Date(null) would be a valid 1970 instant.
    expect(formatTime(null, 'es')).toBe('—')
    expect(formatTime('not a date', 'es')).toBe('—')
    expect(formatTime(Number.NaN, 'en')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it("shows the day and time on the zone's clock, which can be the day before UTC's", () => {
    expect(plain(formatDateTime(LATE_EVENING, 'en', 'medium', 'America/Mexico_City'))).toBe('Oct 19, 2026, 11:15 PM')
    expect(plain(formatDateTime(LATE_EVENING, 'en', 'long', 'America/Mexico_City'))).toBe('October 19, 2026 at 11:15 PM')
  })

  it("defaults to the store's clock, not the machine's", () => {
    inTokyo()

    expect(formatDateTime(LATE_EVENING, 'es')).not.toBe(formatDateTime(LATE_EVENING, 'es', 'medium', 'Asia/Tokyo'))
  })

  it('shows a dash for a missing or malformed instant', () => {
    expect(formatDateTime(undefined, 'es')).toBe('—')
    expect(formatDateTime('not a date', 'es')).toBe('—')
  })
})

describe('formatDate', () => {
  it('shows the calendar day as it is, whatever zone the machine is in', () => {
    inTokyo()

    expect(formatDate('2026-10-19', 'en')).toBe('Oct 19, 2026')
    expect(formatDate('2026-10-19', 'en', 'long')).toBe('October 19, 2026')
  })
})

describe('formatDay', () => {
  it('shows the fields asked for of the calendar day as it is', () => {
    inTokyo()

    expect(formatDay('2026-10-19', 'en', { day: 'numeric', month: 'short' })).toBe('Oct 19')
    expect(formatDay('2026-10-22', 'es', { weekday: 'long' })).toBe('jueves')
  })
})

describe('formatDayRange', () => {
  it('shares what both days have in common', () => {
    inTokyo()

    expect(plain(formatDayRange('2026-10-13', '2026-10-19', 'en'))).toBe('Oct 13 – 19, 2026')
  })

  it('shows a dash for a malformed day', () => {
    expect(formatDayRange('2026-13-45', '2026-10-19', 'en')).toBe('—')
  })
})

describe('formatStoreDate', () => {
  it('shows the store day an instant falls on', () => {
    expect(formatStoreDate(LATE_EVENING, 'en', 'medium', 'America/Mexico_City')).toBe('Oct 19, 2026')
    expect(formatStoreDate(LATE_EVENING, 'en', 'medium', 'UTC')).toBe('Oct 20, 2026')
  })

  it('shows a dash for a missing or malformed instant', () => {
    expect(formatStoreDate(undefined, 'es')).toBe('—')
    expect(formatStoreDate('not a date', 'es')).toBe('—')
  })
})
