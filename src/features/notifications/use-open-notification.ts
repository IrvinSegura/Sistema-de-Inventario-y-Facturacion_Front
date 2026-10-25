import { useNavigate } from 'react-router'

import { notificationLink } from './notification-text'
import { type Notification, useMarkNotificationRead } from './queries'

/** Opening a notification marks it read and goes to what it's about, when it's about something. */
export function useOpenNotification() {
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()
  return (notification: Notification) => {
    // readAt stays empty until the lists refetch: a second click mustn't send it again.
    const sending = markRead.isPending && markRead.variables === notification.id
    if (!notification.readAt && !sending) {
      markRead.mutate(notification.id!)
    }
    const to = notificationLink(notification.type)
    if (to) {
      void navigate(to)
    }
  }
}
