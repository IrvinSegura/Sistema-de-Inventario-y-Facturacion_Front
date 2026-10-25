import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, type Schemas, unwrap } from '@/api/client'
import { errorMessage } from '@/api/errors'
import type { LiveOptions } from '@/lib/live'

export type Notification = Schemas['NotificationResponse']
export type NotificationType = NonNullable<Notification['type']>

// Under 'notifications', so marking any as read refreshes the counter and every list.
export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  page: (unreadOnly: boolean, page: number, size: number) => ['notifications', 'page', unreadOnly, page, size] as const,
}

/**
 * The signed-in user's unread notifications. Only the bell polls it: each observer with an interval
 * keeps its own timer, so a second poller would double the requests.
 */
export function useUnreadNotificationCount({ refetchInterval, staleTime }: LiveOptions = {}) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async () => (await unwrap(api.GET('/api/v1/notifications/unread-count'))).count ?? 0,
    refetchInterval,
    staleTime,
  })
}

/** The user's notifications, newest first (the API fixes the order); `enabled` waits for the bell to open. */
export function useNotifications(
  unreadOnly: boolean, page: number, size: number,
  { enabled = true, refetchInterval, staleTime }: LiveOptions & { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: notificationKeys.page(unreadOnly, page, size),
    queryFn: () => unwrap(api.GET('/api/v1/notifications', { params: { query: { unreadOnly, page, size } } })),
    enabled,
    refetchInterval,
    staleTime,
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.POST('/api/v1/notifications/{id}/read-receipt', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    // Here, not in mutate(): opening a notification often navigates away from the screen that sent it.
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/notifications/read-receipts')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
