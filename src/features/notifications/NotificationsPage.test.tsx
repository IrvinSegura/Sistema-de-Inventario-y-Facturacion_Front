// @vitest-environment jsdom
// jsdom: the page renders into the document, and i18n touches it.
import i18n from '@/i18n'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NotificationsPage } from './NotificationsPage'

// The first page says there are two; the second comes back empty with five left in all, as after
// reading its last unread ones.
const useNotifications = vi.fn((_unreadOnly: boolean, page: number) => ({
  isPending: false, isError: false, isSuccess: true, isPlaceholderData: false,
  data: page === 0
    ? { content: [{ id: 1, type: 'PASSWORD_RESET' }], page: { totalElements: 25 } }
    : { content: [], page: { totalElements: 5 } },
}))

vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  useNotifications: (unreadOnly: boolean, page: number) => useNotifications(unreadOnly, page),
  useUnreadNotificationCount: () => ({ data: 5 }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
}))

afterEach(cleanup)

describe('NotificationsPage', () => {
  it('goes back to the last page when the current one empties', () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: i18n.t('pagination.next') }))

    expect(useNotifications).toHaveBeenCalledWith(false, 1)
    expect(useNotifications).toHaveBeenLastCalledWith(false, 0)
  })
})
