import { useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LIVE_QUERY_OPTIONS } from '@/lib/live'

import { NotificationContent } from './NotificationContent'
import {
  notificationKeys,
  useMarkAllNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from './queries'
import { useOpenNotification } from './use-open-notification'

// The latest few; the page has the rest.
const RECENT_COUNT = 8
// Past this the badge shows "9+": the exact number is on the page.
const BADGE_MAX = 9

/** Bell in the header with the unread count; opening it lists the latest notifications. */
export function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // The only poller of the counter. A failed count just leaves the badge out: the bell is secondary.
  const unread = useUnreadNotificationCount(LIVE_QUERY_OPTIONS).data ?? 0
  const recent = useNotifications(false, 0, RECENT_COUNT, { enabled: open, ...LIVE_QUERY_OPTIONS })
  const markAllRead = useMarkAllNotificationsRead()
  const openNotification = useOpenNotification()
  const rows = recent.data?.content ?? []

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      // The badge may be a minute old and the list half that: refetch both, so they agree.
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      // An old failure of "mark all" mustn't greet the next opening.
      markAllRead.reset()
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')}>
        <Bell />
        {unread > 0 && (
          <span aria-hidden className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
            {unread > BADGE_MAX ? `${BADGE_MAX}+` : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium text-foreground">
            {t('notifications.title')}
          </DropdownMenuLabel>
          {/* A menu item, not a button in the label, so the keyboard reaches it. It stays mounted
              (disabled) once everything is read, so the keyboard doesn't lose its place. */}
          <DropdownMenuItem closeOnClick={false} disabled={unread === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}>
            <CheckCheck />
            {t('notifications.markAllRead')}
          </DropdownMenuItem>
          {markAllRead.isError && (
            <p role="alert" className="px-2 py-1 text-xs text-destructive">{errorMessage(markAllRead.error)}</p>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {recent.isPending ? (
          <div className="m-1 h-24 animate-pulse rounded-md bg-muted/60" />
        ) : recent.isError ? (
          <p role="alert" className="px-2 py-6 text-center text-sm text-destructive">{errorMessage(recent.error)}</p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p>
        ) : (
          <DropdownMenuGroup>
            {rows.map((notification) => (
              <DropdownMenuItem key={notification.id} className="items-start py-2"
                onClick={() => openNotification(notification)}>
                <NotificationContent notification={notification} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center font-medium" onClick={() => void navigate('/notifications')}>
          {t('notifications.viewAll')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
