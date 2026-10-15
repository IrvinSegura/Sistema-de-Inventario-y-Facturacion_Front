import { describe, expect, it } from 'vitest'

import { en } from './locales/en'
import { es } from './locales/es'

// Key parity is checked by TypeScript (es: Messages); this checks what types can't see: every
// translation keeps the same {{variables}} and <tags>, and none is left empty.
function flatten(messages: object, prefix = ''): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? { ...flat, [path]: value } : { ...flat, ...flatten(value, path) }
  }, {})
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map(([match]) => match).sort()
}

describe('translations', () => {
  const english = flatten(en)
  const spanish = flatten(es)

  it.each(Object.keys(english))('%s keeps its placeholders in Spanish', (key) => {
    expect(spanish[key]?.trim()).toBeTruthy()
    expect(placeholders(spanish[key])).toEqual(placeholders(english[key]))
  })
})
