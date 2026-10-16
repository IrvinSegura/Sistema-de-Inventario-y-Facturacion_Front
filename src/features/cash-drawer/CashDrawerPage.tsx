import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toDay } from '@/features/dashboard/days'
import { amountField } from '@/lib/amount-field'
import { formatMoney } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'

import { ClosingDetails, CloseDrawerForm, DrawerPeople } from './DrawerParts'
import { isFromPastDay } from './drawer-day'
import { DrawerSales } from './DrawerSales'
import { formatDate, formatTime } from './format'
import { isAssigned, isResponsible, isShared } from './members'
import { type CashDrawer, useCurrentDrawer, useLatestDrawer, useOpenDrawer } from './queries'

// The drawer the signed-in user sells from: their own, or one a manager assigned them (maybe shared).
// They open their own; only the drawer's responsible counts and closes it.
export function CashDrawerPage() {
  const user = useUser()
  const current = useCurrentDrawer()
  const latest = useLatestDrawer(current.data === null)
  const [today] = useState(() => toDay(new Date()))

  if (current.isPending || (current.data === null && latest.isPending)) {
    return <FullPageSpinner />
  }
  if (current.isError || latest.isError) {
    return <ErrorAlert message={errorMessage(current.error ?? latest.error)} />
  }
  if (current.data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {isResponsible(current.data, user.id)
          ? <CloseDrawerCard drawer={current.data} />
          : <MemberDrawerCard drawer={current.data} />}
        <TicketsCard drawer={current.data} canCancel={managesStore(user.role)} />
      </div>
    )
  }
  const last = latest.data
  // One drawer per user and day: once today's is closed, the next one opens tomorrow.
  const closedToday = !!last?.closing && last.businessDate === today
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {closedToday ? <ClosedTodayCard /> : <OpenDrawerCard suggestedFloat={last?.openingFloat ?? 0} />}
      {last?.closing && <ClosingSummaryCard drawer={last} />}
    </div>
  )
}

function OpenDrawerCard({ suggestedFloat }: { suggestedFloat: number }) {
  const { t } = useTranslation()
  const openDrawer = useOpenDrawer()
  const schema = useMemo(() => z.object({ openingFloat: amountField(t, 999_999.99) }), [t])
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { openingFloat: suggestedFloat },
  })

  const onSubmit = handleSubmit(({ openingFloat }) =>
    openDrawer.mutate(openingFloat, {
      onSuccess: () => showSuccess(t('drawer.opened')),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('drawer.openTitle')}</CardTitle>
        <CardDescription>{t('drawer.openDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {openDrawer.isError && <ErrorAlert message={errorMessage(openDrawer.error)} />}
          <div className="grid gap-2">
            <Label htmlFor="openingFloat">{t('drawer.openingFloatInput')}</Label>
            <Input id="openingFloat" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
              aria-invalid={!!errors.openingFloat} {...register('openingFloat')} />
            {errors.openingFloat
              ? <p className="text-sm text-destructive">{errors.openingFloat.message}</p>
              : suggestedFloat > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('drawer.suggestedFloat', { amount: formatMoney(suggestedFloat) })}
                </p>
              )}
          </div>
          <Button type="submit" size="lg" disabled={openDrawer.isPending}>
            {openDrawer.isPending ? t('drawer.opening') : t('drawer.open')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ClosedTodayCard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
          <CalendarCheck className="size-5 text-muted-foreground" />
        </span>
        <CardTitle>{t('drawer.closedTodayTitle')}</CardTitle>
        <CardDescription>{t('drawer.closedTodayDescription')}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function OpenDrawerHeader({ drawer }: { drawer: CashDrawer }) {
  const { t, i18n } = useTranslation()
  return (
    <CardHeader>
      <CardTitle>{t('drawer.openNow', { date: formatDate(drawer.businessDate!, i18n.language) })}</CardTitle>
      <CardDescription>
        {t('drawer.openedAt', {
          time: formatTime(drawer.openedAt!, i18n.language),
          amount: formatMoney(drawer.openingFloat!),
        })}
      </CardDescription>
    </CardHeader>
  )
}

function CloseDrawerCard({ drawer }: { drawer: CashDrawer }) {
  return (
    <Card>
      <OpenDrawerHeader drawer={drawer} />
      <CardContent className="grid gap-4">
        {(isShared(drawer) || isAssigned(drawer)) && <DrawerPeople drawer={drawer} />}
        <CloseDrawerForm drawer={drawer} />
      </CardContent>
    </Card>
  )
}

// A member who isn't the responsible sells from it, but the responsible counts and closes it.
function MemberDrawerCard({ drawer }: { drawer: CashDrawer }) {
  const { t, i18n } = useTranslation()
  return (
    <Card className="content-start">
      <OpenDrawerHeader drawer={drawer} />
      <CardContent className="grid gap-4">
        {isFromPastDay(drawer.businessDate) && (
          <Alert variant="destructive">
            <AlertTitle>{t('drawer.staleTitle', { date: formatDate(drawer.businessDate!, i18n.language) })}</AlertTitle>
            <AlertDescription>{t('drawer.staleMemberHint')}</AlertDescription>
          </Alert>
        )}
        <DrawerPeople drawer={drawer} />
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Users className="mt-0.5 size-4 shrink-0" />
          {t('drawer.closedByResponsible', { name: drawer.responsible?.name })}
        </p>
      </CardContent>
    </Card>
  )
}

function TicketsCard({ drawer, canCancel }: { drawer: CashDrawer; canCancel: boolean }) {
  const { t } = useTranslation()
  return (
    <Card className="content-start">
      <CardHeader>
        <CardTitle>{t('drawer.tickets')}</CardTitle>
        {/* Sellers only get their own tickets of a shared drawer; managers get everyone's. */}
        <CardDescription>
          {t(isShared(drawer) && !canCancel ? 'drawer.ticketsHintShared' : 'drawer.ticketsHint')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DrawerSales drawerId={drawer.id!} canCancel={canCancel} showSeller={isShared(drawer) && canCancel} />
      </CardContent>
    </Card>
  )
}

function ClosingSummaryCard({ drawer }: { drawer: CashDrawer }) {
  const { t, i18n } = useTranslation()
  const closing = drawer.closing!
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('drawer.lastClosing', { date: formatDate(drawer.businessDate!, i18n.language) })}</CardTitle>
        <CardDescription>
          {t('drawer.closedAtBy', { time: formatTime(closing.closedAt!, i18n.language), name: closing.closedBy?.name })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ClosingDetails drawer={drawer} />
      </CardContent>
    </Card>
  )
}
