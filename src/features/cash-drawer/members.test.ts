import { describe, expect, it } from 'vitest'

import { isAssigned, isResponsible, isShared, memberNames } from './members'
import type { CashDrawer } from './queries'

const ana = { id: 1, name: 'Ana' }
const luis = { id: 2, name: 'Luis' }
const manager = { id: 9, name: 'Marta' }

describe('drawer members', () => {
  it('treats a drawer its only member opened as personal', () => {
    const drawer: CashDrawer = { id: 1, responsible: ana, openedBy: ana, members: [ana] }

    expect(memberNames(drawer)).toBe('Ana')
    expect(isShared(drawer)).toBe(false)
    expect(isAssigned(drawer)).toBe(false)
    expect(isResponsible(drawer, ana.id)).toBe(true)
  })

  it('tells a shared drawer a manager opened and who closes it', () => {
    const drawer: CashDrawer = { id: 2, responsible: luis, openedBy: manager, members: [ana, luis] }

    expect(memberNames(drawer)).toBe('Ana, Luis')
    expect(isShared(drawer)).toBe(true)
    expect(isAssigned(drawer)).toBe(true)
    expect(isResponsible(drawer, ana.id)).toBe(false)
    expect(isResponsible(drawer, luis.id)).toBe(true)
  })

  it('copes with a drawer without members', () => {
    expect(memberNames({ id: 3 })).toBe('')
    expect(isShared({ id: 3 })).toBe(false)
  })
})
