// @vitest-environment jsdom
// jsdom: the bell renders into the document, and i18n touches it.
import i18n from '@/i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationBell } from './NotificationBell'

const useNotifications = vi.fn((..._args: unknown[]) => ({
  isPending: false, isError: false, data: { content: [] },
}))

vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  useUnreadNotificationCount: () => ({ data: 12 }),
  useNotifications: (...args: unknown[]) => useNotifications(...args),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false }),
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

function renderBell() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return screen.getByRole('button', { name: i18n.t('notifications.bellUnread', { count: 12 }) })
}

describe('NotificationBell', () => {
  it('caps the badge at 9+ and reads the exact count aloud', () => {
    renderBell()

    expect(screen.getByText('9+')).toBeTruthy()
  })

  it('fetches the list only once opened', async () => {
    const bell = renderBell()
    expect(useNotifications).toHaveBeenLastCalledWith(false, 0, 8, expect.objectContaining({ enabled: false }))

    fireEvent.click(bell)

    expect(await screen.findByText(i18n.t('notifications.empty'))).toBeTruthy()
    expect(useNotifications).toHaveBeenLastCalledWith(false, 0, 8, expect.objectContaining({ enabled: true }))
  })
})
