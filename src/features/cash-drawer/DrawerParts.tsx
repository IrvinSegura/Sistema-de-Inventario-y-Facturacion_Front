import { zodResolver } from '@hookform/resolvers/zod'
import { Calculator } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { PrintDocument, PrintFields, PrintSection, PrintSignatures, PrintTable, PrintTotals } from '@/components/PrintDocument'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { amountField } from '@/lib/amount-field'
import { formatDate, formatTime } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

import {
  cleanCount,
  type Denomination,
  type DenominationCounts,
  countedTotal,
  denominations,
  MAX_PIECES_DIGITS,
} from './denominations'
import { isFromPastDay } from './drawer-day'
import { differenceClass, differenceLabel, formatDenomination } from './format'
import { isShared, memberNames } from './members'
import { type CashClosing, type CashDrawer, useDayClosing, useCloseDrawer, useDrawerClosing } from './queries'

const NOTE_MAX_LENGTH = 255
const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER'] as const

/** Blind count: the expected cash is only shown after the count is recorded. */
export function CloseDrawerForm({ drawer, autoFocus = true, onClosed }: {
  drawer: CashDrawer
  autoFocus?: boolean
  onClosed?: (drawer: CashDrawer) => void
}) {
  const { t, i18n } = useTranslation()
  const closeDrawer = useCloseDrawer()
  const [counting, setCounting] = useState(false)
  const [counts, setCounts] = useState<DenominationCounts>({})
  const schema = useMemo(() => z.object({
    countedCash: amountField(t, 9_999_999.99),
    note: z.string().trim().max(NOTE_MAX_LENGTH, t('validation.maxChars', { count: NOTE_MAX_LENGTH })).optional(),
  }), [t])
  const { register, handleSubmit, setValue, formState: { errors, isSubmitted } } = useForm({
    resolver: zodResolver(schema),
  })

  // The counter owns the counted cash while it is shown; validate only once the user tried to submit.
  function applyCounts(next: DenominationCounts) {
    setCounts(next)
    setValue('countedCash', countedTotal(next), { shouldDirty: true, shouldValidate: isSubmitted })
  }

  // Showing the counter replaces a typed amount with its total; hiding it leaves that total editable.
  function toggleCounter() {
    if (!counting) {
      applyCounts(counts)
    }
    setCounting(!counting)
  }

  const onSubmit = handleSubmit(({ countedCash, note }) =>
    closeDrawer.mutate({ id: drawer.id!, countedCash, note: note || undefined }, {
      onSuccess: (closed) => {
        showSuccess(t('drawer.closed'))
        onClosed?.(closed)
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {isFromPastDay(drawer.businessDate) && (
        <Alert variant="destructive">
          <AlertTitle>{t('drawer.staleTitle', { date: formatDate(drawer.businessDate!, i18n.language) })}</AlertTitle>
          <AlertDescription>{t('drawer.staleHint')}</AlertDescription>
        </Alert>
      )}
      {closeDrawer.isError && <ErrorAlert message={errorMessage(closeDrawer.error)} />}
      <p className="text-sm text-muted-foreground">{t('drawer.countInstructions')}</p>
      <Button type="button" variant="outline" className="justify-self-start" aria-expanded={counting}
        aria-controls={`denomination-counter-${drawer.id}`} onClick={toggleCounter}>
        <Calculator />
        {counting ? t('drawer.hideCounter') : t('drawer.countByDenomination')}
      </Button>
      {counting && <DenominationCounter id={`denomination-counter-${drawer.id}`} counts={counts} onChange={applyCounts} />}
      <div className="grid gap-2">
        <Label htmlFor={`countedCash-${drawer.id}`}>{t('drawer.countedCashInput')}</Label>
        <Input id={`countedCash-${drawer.id}`} type="number" inputMode="decimal" step="0.01" min="0"
          autoFocus={autoFocus && !counting} readOnly={counting}
          className={cn(counting && 'bg-muted font-medium tabular-nums')}
          aria-invalid={!!errors.countedCash} {...register('countedCash')} />
        {errors.countedCash && <p className="text-sm text-destructive">{errors.countedCash.message}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`note-${drawer.id}`}>{t('drawer.noteInput')}</Label>
        <Input id={`note-${drawer.id}`} maxLength={NOTE_MAX_LENGTH} {...register('note')} />
        {errors.note && <p className="text-sm text-destructive">{errors.note.message}</p>}
      </div>
      <Button type="submit" size="lg" variant="destructive" disabled={closeDrawer.isPending}>
        {closeDrawer.isPending ? t('drawer.closing') : t('drawer.close')}
      </Button>
    </form>
  )
}

/** Pieces per bill and coin, side by side; the form turns each change into the counted cash. */
function DenominationCounter({ id, counts, onChange }: {
  id: string
  counts: DenominationCounts
  onChange: (counts: DenominationCounts) => void
}) {
  const { t } = useTranslation()

  function column(kind: Denomination['kind']) {
    return (
      <fieldset className="grid content-start gap-2">
        <legend className="mb-2 text-sm font-medium">{t(kind === 'bill' ? 'drawer.bills' : 'drawer.coins')}</legend>
        {denominations.filter((denomination) => denomination.kind === kind).map((denomination) => {
          const amount = formatDenomination(denomination.value)
          const inputId = `${id}-${denomination.key}`
          return (
            <div key={denomination.key} className="flex items-center gap-2">
              <Label htmlFor={inputId} className="w-14 justify-end tabular-nums">{amount}</Label>
              {/* Text, not number: browsers ignore maxLength on number inputs; cleanCount drops non-digits. */}
              <Input id={inputId} type="text" inputMode="numeric" maxLength={MAX_PIECES_DIGITS} placeholder="0"
                className="h-8 w-20 text-right tabular-nums"
                aria-label={t(kind === 'bill' ? 'drawer.billsOf' : 'drawer.coinsOf', { amount })}
                value={counts[denomination.key] ?? ''}
                onChange={(event) => onChange({ ...counts, [denomination.key]: cleanCount(event.target.value) })} />
            </div>
          )
        })}
      </fieldset>
    )
  }

  return (
    <div id={id} className="grid gap-3 rounded-lg border p-3">
      <p className="text-sm text-muted-foreground">{t('drawer.counterHint')}</p>
      <div className="grid grid-cols-2 gap-4">
        {column('bill')}
        {column('coin')}
      </div>
    </div>
  )
}

/** Open since or closed at, for the drawer lists. */
export function DrawerStatus({ drawer }: { drawer: CashDrawer }) {
  const { t, i18n } = useTranslation()
  return drawer.closing ? (
    <Badge variant="secondary">{t('drawer.status.closed', { time: formatTime(drawer.closing.closedAt, i18n.language) })}</Badge>
  ) : (
    <Badge className="bg-emerald-600 text-white dark:bg-emerald-500">
      {t('drawer.status.open', { time: formatTime(drawer.openedAt, i18n.language) })}
    </Badge>
  )
}

/** Opening float, expected and counted cash and the difference, as recorded when it was closed. */
function ClosingFigures({ drawer }: { drawer: CashDrawer }) {
  const { t } = useTranslation()
  const closing = drawer.closing!
  return (
    <dl className="grid grid-cols-2 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t('drawer.openingFloat')}</dt>
      <dd className="text-right tabular-nums">{formatMoney(drawer.openingFloat!)}</dd>
      <dt className="text-muted-foreground">{t('drawer.expectedCash')}</dt>
      <dd className="text-right tabular-nums">{formatMoney(closing.expectedCash!)}</dd>
      <dt className="text-muted-foreground">{t('drawer.countedCash')}</dt>
      <dd className="text-right tabular-nums">{formatMoney(closing.countedCash!)}</dd>
      <dt className="font-medium">{t(differenceLabel(closing.difference!))}</dt>
      <dd className={cn('text-right font-medium', differenceClass(closing.difference!))}>
        {formatMoney(closing.difference!)}
      </dd>
    </dl>
  )
}

/** Who sells from the drawer, who closes it and who opened it, for shared or assigned drawers. */
export function DrawerMembers({ drawer }: { drawer: CashDrawer }) {
  const { t } = useTranslation()
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t('drawer.members')}</dt>
      <dd>{memberNames(drawer)}</dd>
      <dt className="text-muted-foreground">{t('drawer.responsible')}</dt>
      <dd>{drawer.responsible?.name}</dd>
      <dt className="text-muted-foreground">{t('drawer.openedByLabel')}</dt>
      <dd>{drawer.openedBy?.name}</dd>
    </dl>
  )
}

/** "Shared" next to a drawer's names in the lists; nothing for a personal drawer. */
export function SharedBadge({ drawer }: { drawer: CashDrawer }) {
  const { t } = useTranslation()
  return isShared(drawer) ? <Badge variant="outline">{t('drawer.shared')}</Badge> : null
}

/**
 * A closed drawer: its figures, its movements by payment method (and by seller when shared) and a
 * printable closing slip.
 */
export function ClosingDetails({ drawer }: { drawer: CashDrawer }) {
  const { t } = useTranslation()
  const closing = useDrawerClosing(drawer.id!)
  return (
    <div className="grid gap-4">
      <ClosingFigures drawer={drawer} />
      {drawer.closing?.note && (
        <p className="text-sm text-muted-foreground">{t('drawer.note', { note: drawer.closing.note })}</p>
      )}
      <Separator />
      <PaymentMethodSection closing={closing} />
      {isShared(drawer) && <BySellerSection closing={closing} />}
      {closing.data && (
        <PrintButton label={t('drawer.print')} className="justify-self-start"
          document={<ClosingSlip drawer={drawer} closing={closing.data} />} />
      )}
    </div>
  )
}

type ClosingQuery = ReturnType<typeof useDayClosing> | ReturnType<typeof useDrawerClosing>

/** A closing's sales and cancellations by payment method, with its loading and error states. */
export function PaymentMethodSection({ closing, title }: {
  closing: ClosingQuery
  title?: string
}) {
  const { t } = useTranslation()
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-medium">{title ?? t('drawer.byPaymentMethod')}</h3>
      {closing.isPending && <p className="text-sm text-muted-foreground">{t('app.loading')}…</p>}
      {closing.isError && <ErrorAlert message={errorMessage(closing.error)} />}
      {closing.data && <PaymentMethodRows closing={closing.data} />}
    </section>
  )
}

/** A shared drawer's movements by seller: the cash each one put in (net of refunds) and all their sales. */
export function BySellerSection({ closing }: { closing: ClosingQuery }) {
  const { t } = useTranslation()
  const sellers = closing.data?.bySeller ?? []
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-medium">{t('drawer.bySeller')}</h3>
      {/* No error here: it always follows a PaymentMethodSection, which shows the same query's error. */}
      {closing.isPending && <p className="text-sm text-muted-foreground">{t('app.loading')}…</p>}
      {closing.data && sellers.length === 0 && <p className="text-sm text-muted-foreground">{t('drawer.noSales')}</p>}
      {sellers.length > 0 && (
        <dl className="grid gap-3 text-sm">
          {sellers.map(({ seller, cash, total }) => (
            <div key={seller?.id} className="grid grid-cols-[1fr_auto] gap-x-4">
              <dt className="font-medium">{seller?.name}</dt>
              <dd className="text-right font-medium tabular-nums">{formatMoney(total?.net ?? 0)}</dd>
              <dd className="col-span-2 text-muted-foreground tabular-nums">
                {t('drawer.sellerCash', { amount: formatMoney(cash?.net ?? 0) })}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

/** Only payment methods with sales or cancellations get a row, then the net total. */
function PaymentMethodRows({ closing }: { closing: CashClosing }) {
  const { t } = useTranslation()
  const rows = PAYMENT_METHODS
    .map((method) => ({ method, amounts: closing.byPaymentMethod?.[method] }))
    .filter(({ amounts }) => (amounts?.saleCount ?? 0) > 0 || (amounts?.cancellationCount ?? 0) > 0)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('drawer.noSales')}</p>
  }
  return (
    <dl className="grid gap-3 text-sm">
      {rows.map(({ method, amounts }) => (
        <div key={method} className="grid grid-cols-[1fr_auto] gap-x-4">
          <dt className="font-medium">{t(`checkout.paymentMethods.${method}`)}</dt>
          <dd className="text-right font-medium tabular-nums">{formatMoney(amounts?.net ?? 0)}</dd>
          <dd className="col-span-2 text-muted-foreground tabular-nums">
            {t('drawer.sales', { count: amounts?.saleCount ?? 0, amount: formatMoney(amounts?.salesTotal ?? 0) })}
            {(amounts?.cancellationCount ?? 0) > 0 && (
              <span className="text-destructive">
                {' · '}
                {t('drawer.cancellations', {
                  count: amounts?.cancellationCount ?? 0,
                  amount: formatMoney(amounts?.cancellationsTotal ?? 0),
                })}
              </span>
            )}
          </dd>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_auto] gap-x-4 border-t pt-3">
        <dt className="font-medium">{t('drawer.netTotal')}</dt>
        <dd className="text-right font-medium tabular-nums">{formatMoney(closing.total?.net ?? 0)}</dd>
      </div>
    </dl>
  )
}

/**
 * Printed closing of a drawer: who and when, sales by payment method (and cash by seller when
 * shared), the cash count and lines to sign.
 */
function ClosingSlip({ drawer, closing }: { drawer: CashDrawer; closing: CashClosing }) {
  const { t, i18n } = useTranslation()
  const figures = drawer.closing!
  const difference = figures.difference!
  const methods = PAYMENT_METHODS.map((method) => ({ method, amounts: closing.byPaymentMethod?.[method] }))
  return (
    <PrintDocument kind={t('print.closing.kind')} folio={drawer.id}
      date={formatDate(drawer.businessDate!, i18n.language, 'long')}>
      {/* Shared adds the members field: four fields in two rows of two, otherwise three in one row. */}
      <PrintFields columns={isShared(drawer) ? 2 : 3} fields={[
        [t('drawer.responsible'), drawer.responsible?.name],
        [t('print.closing.shift'), `${formatTime(drawer.openedAt, i18n.language)} – ${formatTime(figures.closedAt, i18n.language)}`],
        [t('print.closing.closedBy'), figures.closedBy?.name],
        ...(isShared(drawer) ? [[t('drawer.members'), memberNames(drawer)] as [string, string]] : []),
      ]} />
      <PrintSection title={t('print.closing.byMethod')}>
        <PrintTable rows={methods} rowKey={({ method }) => method} columns={[
          { header: t('print.closing.method'), cell: ({ method }) => t(`checkout.paymentMethods.${method}`), className: 'font-medium text-slate-900' },
          { header: t('print.closing.sales'), cell: ({ amounts }) => amounts?.saleCount ?? 0, numeric: true },
          { header: t('print.columns.amount'), cell: ({ amounts }) => formatMoney(amounts?.salesTotal ?? 0), numeric: true },
          {
            header: t('print.closing.cancellations'),
            cell: ({ amounts }) => (amounts?.cancellationCount ?? 0) > 0
              ? <span className="text-red-700">−{formatMoney(amounts?.cancellationsTotal ?? 0)} ({amounts?.cancellationCount})</span>
              : '—',
            numeric: true,
          },
          { header: t('print.closing.net'), cell: ({ amounts }) => formatMoney(amounts?.net ?? 0), numeric: true, className: 'font-semibold' },
        ]} />
        <PrintTotals rows={[{ label: t('drawer.netTotal'), value: formatMoney(closing.total?.net ?? 0), grand: true }]} />
      </PrintSection>
      {isShared(drawer) && (
        <PrintSection title={t('print.closing.bySeller')}>
          <PrintTable rows={closing.bySeller ?? []} rowKey={({ seller }, index) => seller?.id ?? index} columns={[
            { header: t('print.closing.seller'), cell: ({ seller }) => seller?.name, className: 'font-medium text-slate-900' },
            { header: t('checkout.paymentMethods.CASH'), cell: ({ cash }) => formatMoney(cash?.net ?? 0), numeric: true },
            { header: t('checkout.total'), cell: ({ total }) => formatMoney(total?.net ?? 0), numeric: true, className: 'font-semibold' },
          ]} />
        </PrintSection>
      )}
      <PrintSection title={t('print.closing.cash')}>
        <PrintTotals
          aside={figures.note && t('drawer.note', { note: figures.note })}
          rows={[
            { label: t('drawer.openingFloat'), value: formatMoney(drawer.openingFloat!) },
            { label: t('drawer.expectedCash'), value: formatMoney(figures.expectedCash!) },
            { label: t('drawer.countedCash'), value: formatMoney(figures.countedCash!) },
            {
              label: t(differenceLabel(difference)),
              value: formatMoney(difference),
              strong: true,
              tone: difference < 0 ? 'danger' : difference > 0 ? 'warning' : undefined,
            },
          ]} />
      </PrintSection>
      <PrintSignatures signers={[
        { label: t('drawer.responsibleSignature'), name: drawer.responsible?.name },
        { label: t('drawer.managerSignature') },
      ]} />
    </PrintDocument>
  )
}
