import { describe, expect, it } from 'vitest'

import { CODE, LABEL, NOT_CODE_CHAR, NOT_LABEL_CHAR, NOT_PERSON_NAME_CHAR, PERSON_NAME } from './text-rules'

describe('text rules', () => {
  it('accepts real product, category and person names', () => {
    expect(LABEL.test('Jabón Zote 400 g (2 pzs)')).toBe(true)
    expect(LABEL.test('Coca-Cola 600 ml')).toBe(true)
    expect(LABEL.test('Leche 1L 100% entera')).toBe(true)
    expect(PERSON_NAME.test("María José O'Neil-Peña")).toBe(true)
    expect(CODE.test('ABC-001_X.2')).toBe(true)
  })

  it('rejects markup, symbols and leading punctuation', () => {
    expect(LABEL.test('<b>Bold</b>')).toBe(false)
    expect(LABEL.test('-Leche')).toBe(false)
    expect(PERSON_NAME.test('Agent 007')).toBe(false)
    expect(CODE.test('SKU 1!')).toBe(false)
    expect(CODE.test('-ABC')).toBe(false)
  })

  it('strips characters outside each rule while typing', () => {
    expect('Pan <dulce>'.replace(NOT_LABEL_CHAR, '')).toBe('Pan dulce')
    expect('ab c!-1'.replace(NOT_CODE_CHAR, '')).toBe('abc-1')
    expect('Ana 2'.replace(NOT_PERSON_NAME_CHAR, '')).toBe('Ana ')
  })
})
