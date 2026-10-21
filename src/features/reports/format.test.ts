import { describe, expect, it } from 'vitest'

import { bucketLabel, bucketTitle } from './format'

// Intl spaces some ranges with thin spaces; plain ones keep the expectations readable.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('bucketLabel', () => {
  it('names a day or week by its first day, and a month by its name', () => {
    expect(bucketLabel({ start: '2026-10-19', end: '2026-10-25' }, 'week', 'en')).toBe('Oct 19')
    expect(bucketLabel({ start: '2026-10-01', end: '2026-10-31' }, 'month', 'en')).toBe('Oct 2026')
  })
})

describe('bucketTitle', () => {
  it('names a whole month', () => {
    expect(bucketTitle({ start: '2026-10-01', end: '2026-10-31' }, 'month', 'es')).toBe('octubre de 2026')
  })

  it('shows the dates of a month cut by the range', () => {
    expect(plain(bucketTitle({ start: '2026-10-01', end: '2026-10-15' }, 'month', 'en'))).toBe('Oct 1 – 15, 2026')
  })

  it('shows a single day, or a week as a range', () => {
    expect(bucketTitle({ start: '2026-10-19', end: '2026-10-19' }, 'day', 'en')).toBe('Oct 19, 2026')
    expect(plain(bucketTitle({ start: '2026-10-19', end: '2026-10-25' }, 'week', 'en'))).toBe('Oct 19 – 25, 2026')
  })
})
