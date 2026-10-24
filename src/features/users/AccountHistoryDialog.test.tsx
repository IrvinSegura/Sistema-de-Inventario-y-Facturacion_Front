// @vitest-environment jsdom
// jsdom: the dialog renders into the document, and i18n touches it.
import i18n from '@/i18n'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AccountHistoryDialog } from './AccountHistoryDialog'
import type { AccountEvent } from './queries'

const events: AccountEvent[] = [
  { id: 3, type: 'ROLE_CHANGED', oldValue: 'SELLER', newValue: 'SUPERVISOR', actor: { id: 1, name: 'Admin' }, occurredAt: '2026-10-22T18:00:00Z' },
  { id: 2, type: 'EMAIL_CHANGED', oldValue: 'old@test.com', newValue: 'new@test.com', actor: { id: 1, name: 'Admin' }, occurredAt: '2026-10-22T17:00:00Z' },
  { id: 1, type: 'PASSWORD_CHANGED', actor: { id: 7, name: 'Ana' }, occurredAt: '2026-10-22T16:00:00Z' },
  { id: 5, type: 'PHONE_CHANGED', oldValue: '5512345678', actor: { id: 1, name: 'Admin' }, occurredAt: '2026-10-22T15:00:00Z' },
  { id: 4, type: 'PASSWORD_CHANGED', oldValue: 'TEMPORARY', actor: { id: 7, name: 'Ana' }, occurredAt: '2026-10-22T14:00:00Z' },
]

// Only the history query is replaced; the dialog's other imports are real.
vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  useAccountEvents: () => ({
    isPending: false, isError: false, isPlaceholderData: false,
    data: { content: events, page: { totalElements: events.length } },
  }),
}))

afterEach(cleanup)

describe('AccountHistoryDialog', () => {
  it('describes each change, with both values and who made it', () => {
    render(<AccountHistoryDialog account={{ id: 7, name: 'Ana' }} onOpenChange={() => {}} />)

    expect(screen.getByText(i18n.t('users.history.types.ROLE_CHANGED', {
      from: i18n.t('app.roles.SELLER'), to: i18n.t('app.roles.SUPERVISOR'),
    }))).toBeTruthy()
    expect(screen.getByText(i18n.t('users.history.types.EMAIL_CHANGED', { from: 'old@test.com', to: 'new@test.com' })))
      .toBeTruthy()
    expect(screen.getByText(i18n.t('users.history.types.PASSWORD_CHANGED'))).toBeTruthy()
    expect(screen.getAllByText(/Admin/)).toHaveLength(3)
  })

  it('names a removed phone and a replaced temporary password', () => {
    render(<AccountHistoryDialog account={{ id: 7, name: 'Ana' }} onOpenChange={() => {}} />)

    expect(screen.getByText(i18n.t('users.history.types.PHONE_CHANGED', {
      from: '5512345678', to: i18n.t('users.history.noPhone'),
    }))).toBeTruthy()
    expect(screen.getByText(i18n.t('users.history.temporaryReplaced'))).toBeTruthy()
  })
})
