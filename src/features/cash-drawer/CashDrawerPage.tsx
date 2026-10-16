import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dateLocale } from '@/i18n'
import { amountField } from '@/lib/amount-field'
import { formatMoney } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

import {
  type CashDrawer,
  useCloseDrawer,
  useCurrentDrawer,
  useLatestDrawer,
  useOpenDrawer,
} from './queries'

const NOTE_MAX_LENGTH = 255

export function CashDrawerPage() {
  const current = useCurrentDrawer()
  const latest = useLatestDrawer(current.data === null)

  if (current.isPending) {
    return <FullPageSpinner />
  }
  if (current.isError) {
    return <ErrorAlert message={errorMessage(current.error)} />
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {current.data ? <CloseDrawerCard drawer={current.data} /> : <OpenDrawerCard />}
      {!current.data && latest.data?.closing && <ClosingSummaryCard drawer={latest.data} />}
    </div>
  )
}

function OpenDrawerCard() {
  const { t } = useTranslation()
  const openDrawer = useOpenDrawer()
  const schema = useMemo(() => z.object({ openingFloat: amountField(t, 999_999.99) }), [t])
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { openingFloat: 0 },
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
            {errors.openingFloat && <p className="text-sm text-destructive">{errors.openingFloat.message}</p>}
          </div>
          <Button type="submit" size="lg" disabled={openDrawer.isPending}>
            {openDrawer.isPending ? t('drawer.opening') : t('drawer.open')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CloseDrawerCard({ drawer }: { drawer: CashDrawer }) {
  const { t, i18n } = useTranslation()
  const closeDrawer = useCloseDrawer()
  const schema = useMemo(() => z.object({
    countedCash: amountField(t, 9_999_999.99),
    note: z.string().trim().max(NOTE_MAX_LENGTH, t('validation.maxChars', { count: NOTE_MAX_LENGTH })).optional(),
  }), [t])
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(({ countedCash, note }) =>
    closeDrawer.mutate({ id: drawer.id!, countedCash, note: note || undefined }, {
      onSuccess: () => showSuccess(t('drawer.closed')),
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('drawer.openNow', { date: formatDate(drawer.businessDate!, i18n.language) })}</CardTitle>
        <CardDescription>
          {t('drawer.openedAt', {
            time: formatTime(drawer.openedAt!, i18n.language),
            amount: formatMoney(drawer.openingFloat!),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {closeDrawer.isError && <ErrorAlert message={errorMessage(closeDrawer.error)} />}
          {/* Blind count: the expected cash is only shown after the count is recorded. */}
          <p className="text-sm text-muted-foreground">{t('drawer.countInstructions')}</p>
          <div className="grid gap-2">
            <Label htmlFor="countedCash">{t('drawer.countedCashInput')}</Label>
            <Input id="countedCash" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
              aria-invalid={!!errors.countedCash} {...register('countedCash')} />
            {errors.countedCash && <p className="text-sm text-destructive">{errors.countedCash.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">{t('drawer.noteInput')}</Label>
            <Input id="note" maxLength={NOTE_MAX_LENGTH} {...register('note')} />
            {errors.note && <p className="text-sm text-destructive">{errors.note.message}</p>}
          </div>
          <Button type="submit" size="lg" variant="destructive" disabled={closeDrawer.isPending}>
            {closeDrawer.isPending ? t('drawer.closing') : t('drawer.close')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ClosingSummaryCard({ drawer }: { drawer: CashDrawer }) {
  const { t, i18n } = useTranslation()
  const closing = drawer.closing!
  const difference = closing.difference!
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('drawer.lastClosing', { date: formatDate(drawer.businessDate!, i18n.language) })}</CardTitle>
        <CardDescription>
          {t('drawer.closedAtBy', { time: formatTime(closing.closedAt!, i18n.language), name: closing.closedBy?.name })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t('drawer.openingFloat')}</dt>
          <dd className="text-right tabular-nums">{formatMoney(drawer.openingFloat!)}</dd>
          <dt className="text-muted-foreground">{t('drawer.expectedCash')}</dt>
          <dd className="text-right tabular-nums">{formatMoney(closing.expectedCash!)}</dd>
          <dt className="text-muted-foreground">{t('drawer.countedCash')}</dt>
          <dd className="text-right tabular-nums">{formatMoney(closing.countedCash!)}</dd>
          <dt className="font-medium">
            {t(difference < 0 ? 'drawer.shortage' : difference > 0 ? 'drawer.surplus' : 'drawer.difference')}
          </dt>
          <dd className={cn('text-right font-medium tabular-nums',
            difference < 0 && 'text-destructive', difference > 0 && 'text-amber-600 dark:text-amber-400')}>
            {formatMoney(difference)}
          </dd>
        </dl>
        {closing.note && <p className="mt-4 text-sm text-muted-foreground">{t('drawer.note', { note: closing.note })}</p>}
      </CardContent>
    </Card>
  )
}

function formatTime(instant: string, language: string): string {
  return new Date(instant).toLocaleTimeString(dateLocale(language), { hour: '2-digit', minute: '2-digit' })
}

// Business dates are plain local days ("2026-10-15"); parsed at noon so no time zone shifts the day.
function formatDate(day: string, language: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(language), { dateStyle: 'medium' })
}
