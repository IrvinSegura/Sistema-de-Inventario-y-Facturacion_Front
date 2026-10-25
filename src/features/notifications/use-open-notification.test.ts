// @vitest-environment jsdom
// jsdom: renderHook mounts a component.
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useOpenNotification } from './use-open-notification'

const navigate = vi.fn()
const markRead = { mutate: vi.fn(), isPending: false, variables: undefined as number | undefined }

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}))
vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  useMarkNotificationRead: () => markRead,
}))

beforeEach(() => {
  vi.clearAllMocks()
  markRead.isPending = false
  markRead.variables = undefined
})
afterEach(cleanup)

describe('useOpenNotification', () => {
  it('marks an unread notification read and goes to what it is about', () => {
    const open = renderHook(() => useOpenNotification()).result.current

    open({ id: 3, type: 'CASH_DRAWER_ASSIGNED' })

    expect(markRead.mutate).toHaveBeenCalledWith(3)
    expect(navigate).toHaveBeenCalledWith('/cash-drawer')
  })

  it('neither marks a read one nor navigates for an account change', () => {
    const open = renderHook(() => useOpenNotification()).result.current

    open({ id: 4, type: 'PASSWORD_RESET', readAt: '2026-10-23T10:00:00Z' })

    expect(markRead.mutate).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("doesn't send the same read receipt twice while the first is on its way", () => {
    markRead.isPending = true
    markRead.variables = 5
    const open = renderHook(() => useOpenNotification()).result.current

    open({ id: 5, type: 'EMAIL_CHANGED' })

    expect(markRead.mutate).not.toHaveBeenCalled()
  })

  it("still sends another notification's read receipt meanwhile", () => {
    markRead.isPending = true
    markRead.variables = 5
    const open = renderHook(() => useOpenNotification()).result.current

    open({ id: 6, type: 'EMAIL_CHANGED' })

    expect(markRead.mutate).toHaveBeenCalledWith(6)
  })
})
