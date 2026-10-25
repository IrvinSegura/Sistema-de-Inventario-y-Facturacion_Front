import { BellOff, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { LIVE_QUERY_OPTIONS } from '@/lib/live'
import { usePageSize } from '@/lib/use-page-size'

import { NotificationContent } from './NotificationContent'
import { useMarkAllNotificationsRead, useNotifications, useUnreadNotificationCount } from './queries'
import { useOpenNotification } from './use-open-notification'

const ALL = 'all'
const UNREAD = 'unread'

/** Every notification of the signed-in user, newest first, for any role. */
export function NotificationsPage() {
  const { t } = useTranslation()
  const [show, setShow] = useState(ALL)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('notifications')
  const unreadOnly = show === UNREAD
  const notifications = useNotifications(unreadOnly, page, pageSize, LIVE_QUERY_OPTIONS)
  // Not polled here: the bell in the header already does, and a second timer would double it.
  const unread = useUnreadNotificationCount().data ?? 0
  const markAllRead = useMarkAllNotificationsRead()
  const openNotification = useOpenNotification()
  const rows = notifications.data?.content ?? []
  const total = notifications.data?.page?.totalElements ?? 0
  // Reading the last unread ones empties a page past the first: go back to the new last page. Only
  // ever back, so a total that disagrees with the rows can't bounce it between pages.
  const loaded = notifications.isSuccess && !notifications.isPlaceholderData
  if (loaded && rows.length === 0 && page > 0) {
    setPage(Math.min(page - 1, Math.max(0, Math.ceil(total / pageSize) - 1)))
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('notifications.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('notifications.description')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="notifications-show">{t('notifications.filter')}</Label>
            <Select id="notifications-show" className="w-36" value={show}
              onValueChange={(value) => {
                if (value) {
                  setShow(value)
                  setPage(0)
                }
              }}
              options={[
                { value: ALL, label: t('notifications.all') },
                { value: UNREAD, label: t('notifications.unread') },
              ]} />
          </div>
          <Button variant="outline" disabled={unread === 0 || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            <CheckCheck />
            {t('notifications.markAllRead')}
          </Button>
        </div>
      </div>

      {markAllRead.isError && <ErrorAlert message={errorMessage(markAllRead.error)} />}
      {notifications.isPending ? (
        <TableSkeleton />
      ) : notifications.isError ? (
        <ErrorAlert message={errorMessage(notifications.error)} />
      ) : (
        <Card className="gap-0 py-0">
          {rows.length === 0 ? (
            <EmptyState icon={BellOff} text={t(unreadOnly ? 'notifications.emptyUnread' : 'notifications.empty')} />
          ) : (
            <ul className="divide-y">
              {rows.map((notification) => (
                <li key={notification.id}>
                  <button type="button" onClick={() => openNotification(notification)}
                    className="flex w-full px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
                    <NotificationContent notification={notification} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {total > 0 && (
            <Pagination page={page} pageSize={pageSize} total={total} loading={notifications.isPlaceholderData}
              onPageChange={setPage} onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(0)
              }} />
          )}
        </Card>
      )}
    </div>
  )
}
