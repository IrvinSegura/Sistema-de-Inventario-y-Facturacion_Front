import { describe, expect, it } from 'vitest'

import { highlightParts } from './highlight'

describe('highlightParts', () => {
  it('marks every match ignoring case', () => {
    expect(highlightParts('Arroz y arroz', 'ARROZ')).toEqual([
      { text: 'Arroz', match: true },
      { text: ' y ', match: false },
      { text: 'arroz', match: true },
    ])
  })

  it('ignores accents in both the text and the search', () => {
    expect(highlightParts('Café soluble', 'cafe')).toEqual([
      { text: 'Café', match: true },
      { text: ' soluble', match: false },
    ])
    expect(highlightParts('Jabon', 'jabón')).toEqual([{ text: 'Jabon', match: true }])
  })

  it('keeps decomposed accents with their letter', () => {
    const text = 'Café negro'
    expect(highlightParts(text, 'café')).toEqual([
      { text: 'Café', match: true },
      { text: ' negro', match: false },
    ])
  })

  it('returns the whole text when nothing matches or the search is blank', () => {
    expect(highlightParts('Leche', 'pan')).toEqual([{ text: 'Leche', match: false }])
    expect(highlightParts('Leche', '  ')).toEqual([{ text: 'Leche', match: false }])
  })
})
