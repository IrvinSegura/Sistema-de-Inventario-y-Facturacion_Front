// @vitest-environment jsdom
// jsdom: format.ts loads i18n, which touches document.
import { afterEach, describe, expect, it } from 'vitest'

import { STORE_TIME_ZONE } from '@/features/dashboard/days'

import { formatTime } from './format'

// Intl separates "p.m." with a narrow no-break space; plain spaces keep the expectations readable.
const time = (...args: Parameters<typeof formatTime>) => formatTime(...args).replace(/\s/g, ' ')

describe('formatTime', () => {
  const machineZone = process.env.TZ

  afterEach(() => {
    process.env.TZ = machineZone
  })

  it("defaults to the store's clock, whatever zone the browser is in", () => {
    // A machine zone no store is in, so the browser's clock can't pass for the store's.
    process.env.TZ = 'Asia/Tokyo'

    expect(time('2026-10-20T05:15:00Z', 'en')).toBe(time('2026-10-20T05:15:00Z', 'en', STORE_TIME_ZONE))
    expect(time('2026-10-20T05:15:00Z', 'en')).not.toBe('02:15 PM')
  })

  it("shows the zone's wall clock, not UTC", () => {
    // 05:15 UTC is 23:15 the day before in Mexico City.
    expect(time('2026-10-20T05:15:00Z', 'es', 'America/Mexico_City')).toBe('11:15 p.m.')
    expect(time('2026-10-20T05:15:00Z', 'en', 'America/Mexico_City')).toBe('11:15 PM')
  })

  it('follows the zone it is given', () => {
    expect(time('2026-10-20T05:15:00Z', 'en', 'America/Tijuana')).toBe('10:15 PM')
    expect(time('2026-10-20T05:15:00Z', 'en', 'UTC')).toBe('05:15 AM')
  })

  it('shows a dash for a missing or malformed instant', () => {
    expect(formatTime('not a date', 'es')).toBe('—')
    expect(formatTime(Number.NaN, 'en')).toBe('—')
  })
})
