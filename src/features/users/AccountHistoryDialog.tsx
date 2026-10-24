import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Pagination } from '@/components/Pagination'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/date-format'

import { type AccountEvent, useAccountEvents, type UserAccount } from './queries'

// A short list: the history is read now and then, not browsed.
const HISTORY_PAGE_SIZE = 10

/** Who created the account and changed its email, phone, role, status or password, newest first. */
export function AccountHistoryDialog({ account, onOpenChange }: {
  account: UserAccount | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  // Keeps the last account on screen while the dialog animates out.
  const [shown, setShown] = useState(account)
  if (account && account !== shown) {
    setShown(account)
  }
  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('users.history.title', { name: shown?.name })}</DialogTitle>
          <DialogDescription>{t('users.history.description')}</DialogDescription>
        </DialogHeader>
        {/* Keyed by account, so every opening starts on the first page. */}
        {shown && <HistoryList key={shown.id} accountId={shown.id!} />}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('app.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistoryList({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(0)
  const events = useAccountEvents(accountId, page, HISTORY_PAGE_SIZE)

  if (events.isError) {
    return <ErrorAlert message={errorMessage(events.error)} />
  }
  if (events.isPending) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
  }
  const rows = events.data.content ?? []
  return (
    <div className="grid gap-3">
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('users.history.empty')}</p>
      ) : (
        <ol className="max-h-[50svh] divide-y overflow-y-auto rounded-lg border">
          {rows.map((event) => (
            <li key={event.id} className="grid gap-0.5 px-3 py-2.5">
              <span className="text-sm font-medium">{describeEvent(event, t)}</span>
              <span className="text-xs text-muted-foreground">
                {t('users.history.by', {
                  name: event.actor?.name, date: formatDateTime(event.occurredAt, i18n.language),
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
      {(events.data.page?.totalElements ?? 0) > HISTORY_PAGE_SIZE && (
        <Pagination page={page} pageSize={HISTORY_PAGE_SIZE} total={events.data.page?.totalElements ?? 0}
          loading={events.isPlaceholderData} onPageChange={setPage} />
      )}
    </div>
  )
}

/** One line per event; email, phone and role changes show the value before and after. */
function describeEvent(event: AccountEvent, t: TFunction): string {
  switch (event.type) {
    case 'EMAIL_CHANGED':
      return t('users.history.types.EMAIL_CHANGED', { from: event.oldValue, to: event.newValue })
    case 'PHONE_CHANGED':
      // Either side is empty when the phone was added or removed.
      return t('users.history.types.PHONE_CHANGED', {
        from: event.oldValue ?? t('users.history.noPhone'),
        to: event.newValue ?? t('users.history.noPhone'),
      })
    case 'ROLE_CHANGED':
      return t('users.history.types.ROLE_CHANGED', {
        from: t(`app.roles.${event.oldValue as 'ADMIN' | 'SUPERVISOR' | 'SELLER'}`),
        to: t(`app.roles.${event.newValue as 'ADMIN' | 'SUPERVISOR' | 'SELLER'}`),
      })
    case 'PASSWORD_CHANGED':
      // The API marks the first change after a reset: the user replaced the temporary password.
      return event.oldValue === 'TEMPORARY'
        ? t('users.history.temporaryReplaced')
        : t('users.history.types.PASSWORD_CHANGED')
    default:
      return t(`users.history.types.${event.type!}`)
  }
}
