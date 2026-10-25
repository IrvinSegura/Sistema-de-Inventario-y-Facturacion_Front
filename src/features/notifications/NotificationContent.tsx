import { useTranslation } from 'react-i18next'

import { formatDateTime } from '@/lib/date-format'
import { cn } from '@/lib/utils'

import { describeNotification } from './notification-text'
import type { Notification } from './queries'

/** Title, detail and time of a notification, with a dot while it's unread; the bell and the page wrap it. */
export function NotificationContent({ notification }: { notification: Notification }) {
  const { t, i18n } = useTranslation()
  const text = describeNotification(notification, t, i18n.language)
  const unread = !notification.readAt
  return (
    <span className="flex min-w-0 flex-1 items-start gap-2.5">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')}>
        {unread && <span className="sr-only">{t('notifications.unreadMark')}</span>}
      </span>
      <span className="grid min-w-0 gap-0.5 text-left">
        <span className={cn('text-sm', unread ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {text.title}
        </span>
        {text.detail && <span className="text-xs break-words text-muted-foreground">{text.detail}</span>}
        <span className="text-xs text-muted-foreground">{formatDateTime(notification.createdAt, i18n.language)}</span>
      </span>
    </span>
  )
}
