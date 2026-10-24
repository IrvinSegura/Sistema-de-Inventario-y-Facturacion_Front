import { describe, expect, it } from 'vitest'

import { generateTemporaryPassword } from './temporary-password'

describe('generateTemporaryPassword', () => {
  it('has the requested length and no look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword()
      expect(password).toHaveLength(12)
      expect(password).toMatch(/^[A-HJKMNP-Za-hjkmnp-z2-9]+$/)
    }
    expect(generateTemporaryPassword(20)).toHaveLength(20)
  })

  it('differs every time', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()))
    expect(passwords.size).toBe(100)
  })
})
