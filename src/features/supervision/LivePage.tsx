import { CircleCheck, Eye, RefreshCw, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { LoadingBlock } from '@/components/LoadingBlock'
import { StatTile } from '@/components/StatTile'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DrawerDetailDialog } from '@/features/cash-drawer/DrawerDetailDialog'
import { DrawerStatus, SharedBadge } from '@/features/cash-drawer/DrawerParts'
import { differenceClass, differenceLabel } from '@/features/cash-drawer/format'
import { memberNames } from '@/features/cash-drawer/members'
import { type CashDrawer, useDayClosing } from '@/features/cash-drawer/queries'
import { movementsLink } from '@/features/inventory/movement-params'
import { formatPercent } from '@/features/reports/format'
import { useDayCancellations } from '@/features/sales/queries'
import { formatDay, formatTime } from '@/lib/date-format'
import { addDays } from '@/lib/days'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

import { CancellationsCard } from './CancellationsCard'
import { LIVE_QUERY_OPTIONS, useSharedLiveAlerts } from './live-alerts'
import { alertCount, averageTicket, type LiveAlerts, salesShare, type SellerDay, sellerDays } from './live-day'

/** Managers' live view of the store's day; today's figures and every alert poll every REFRESH_EVERY_MS. */
export function LivePage() {
  const { t, i18n } = useTranslation()
  const { today, day, staleDrawers, alerts, alertsError, isFetching, refetch } = useSharedLiveAlerts()
  const cancellations = useDayCancellations(today, LIVE_QUERY_OPTIONS)
  // Neither polled nor asked again on every visit: a past day's sales no longer change.
  const lastWeekDay = addDays(today, -7)
  const lastWeek = useDayClosing(lastWeekDay, { staleTime: Infinity })
  // By id, so the dialog follows the refreshed drawer (e.g. one someone else just closed).
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (day.isPending) {
    return <LoadingBlock />
  }
  if (day.isLoadingError) {
    return <ErrorAlert message={errorMessage(day.error)} />
  }

  const drawers = day.data.drawers ?? []
  const total = day.data.total
  const openCount = drawers.filter((drawer) => !drawer.closing).length
  const sellers = sellerDays(day.data)
  // Stale ones too: past midnight a drawer left open moves from today's list to the stale one.
  const selected = [...drawers, ...(staleDrawers.data ?? [])].find((drawer) => drawer.id === selectedId) ?? null
  const fetching = isFetching || cancellations.isFetching
  const updatedAt = formatTime(day.dataUpdatedAt, i18n.language)
  const view = (drawer: CashDrawer) => setSelectedId(drawer.id ?? null)

  function refresh() {
    void Promise.all([refetch(), cancellations.refetch()])
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>{t('supervision.live.updatedAt', { time: updatedAt })}</p>
        <Button variant="outline" size="sm" disabled={fetching} onClick={refresh}>
          <RefreshCw className={cn(fetching && 'animate-spin')} />
          {t('supervision.live.refresh')}
        </Button>
      </div>

      {/* A failed refresh keeps the last figures on screen. */}
      {day.isRefetchError && (
        <Alert variant="destructive">
          <AlertTitle>{t('supervision.live.refreshFailed', { time: updatedAt })}</AlertTitle>
          <AlertDescription>{errorMessage(day.error)}</AlertDescription>
        </Alert>
      )}

      {/* "Nothing pending" only once every alert could be checked. */}
      {alertsError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('supervision.live.alerts.failed')}</AlertTitle>
          <AlertDescription>{errorMessage(alertsError)}</AlertDescription>
        </Alert>
      ) : alerts && (
        <Alerts alerts={alerts} today={today} onView={view} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('supervision.live.stats.sold')} value={formatMoney(total?.salesTotal ?? 0)}
          hint={(
            <>
              {t('supervision.live.stats.soldHint', { count: total?.saleCount ?? 0, average: formatMoney(averageTicket(total)) })}
              {lastWeek.data && (
                <SoldVsLastWeek soFar={total?.salesTotal ?? 0} lastWeek={lastWeek.data.total?.salesTotal ?? 0} day={lastWeekDay} />
              )}
            </>
          )} />
        <StatTile label={t('supervision.live.stats.cancelled')}
          value={<span className={cn((total?.cancellationCount ?? 0) > 0 && 'text-destructive')}>{formatMoney(total?.cancellationsTotal ?? 0)}</span>}
          hint={t('supervision.live.stats.cancelledHint', { count: total?.cancellationCount ?? 0 })} />
        <StatTile label={t('supervision.live.stats.net')} value={formatMoney(total?.net ?? 0)}
          hint={t('supervision.live.stats.netHint')} />
        <StatTile label={t('drawer.today.expectedInDrawers')} value={formatMoney(day.data.expectedCash ?? 0)}
          hint={t('drawer.today.openCount', { open: openCount, total: drawers.length })} />
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>{t('supervision.live.sellers.title')}</CardTitle>
          <CardDescription>{t('supervision.live.sellers.description')}</CardDescription>
        </CardHeader>
        {sellers.length === 0 ? (
          <EmptyState icon={Users} text={t('supervision.live.sellers.empty')} />
        ) : (
          <SellersTable sellers={sellers} onView={view} />
        )}
      </Card>

      <CancellationsCard cancellations={cancellations} today={today} />

      <DrawerDetailDialog drawer={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  )
}

/**
 * Today's sales so far against the whole same weekday last week (its figures are final). A share,
 * not a change: the day isn't over, so "60 %" at noon may be right on track.
 */
function SoldVsLastWeek({ soFar, lastWeek, day }: { soFar: number; lastWeek: number; day: string }) {
  const { t, i18n } = useTranslation()
  const weekday = formatDay(day, i18n.language, { weekday: 'long' })
  const share = salesShare(soFar, lastWeek)
  return (
    <span className="block">
      {share === null
        ? t('supervision.live.stats.soldNoneLastWeek', { weekday })
        : t('supervision.live.stats.soldVsLastWeek', { percent: formatPercent(share, i18n.language), weekday, amount: formatMoney(lastWeek) })}
    </span>
  )
}

/**
 * Stale drawers, unbalanced closings, low stock, and today's manual stock adjustments and purchase
 * cancellations: only what needs a look; a quiet line when nothing does.
 */
function Alerts({ alerts, today, onView }: { alerts: LiveAlerts; today: string; onView: (drawer: CashDrawer) => void }) {
  const { t } = useTranslation()
  const { stale, unbalanced, lowStockCount, adjustmentCount, purchaseCancellationCount } = alerts
  if (alertCount(alerts) === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
        {t('supervision.live.alerts.none')}
      </p>
    )
  }
  return (
    <section aria-label={t('supervision.live.alerts.label')} className="grid gap-2">
      {stale.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{t('drawer.today.staleTitle', { count: stale.length })}</AlertTitle>
          <AlertAction>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/cash-drawer/today" />}>
              {t('drawer.today.review')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {unbalanced.map(({ drawer, difference }) => (
        <Alert key={drawer.id} variant={difference < 0 ? 'destructive' : 'default'}>
          <AlertTitle>
            {t('supervision.live.alerts.unbalanced', {
              label: t(differenceLabel(difference)), amount: formatMoney(Math.abs(difference)), name: memberNames(drawer),
            })}
          </AlertTitle>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => onView(drawer)}>{t('supervision.live.alerts.viewDrawer')}</Button>
          </AlertAction>
        </Alert>
      ))}
      {lowStockCount > 0 && (
        <Alert>
          <AlertTitle>{t('supervision.live.alerts.lowStock', { count: lowStockCount })}</AlertTitle>
          <AlertAction>
            <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/inventory/low-stock" />}>
              {t('supervision.live.alerts.viewProducts')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {adjustmentCount > 0 && (
        <Alert>
          <AlertTitle>{t('supervision.live.alerts.adjustments', { count: adjustmentCount })}</AlertTitle>
          <AlertAction>
            <Button size="sm" variant="outline" nativeButton={false}
              render={<Link to={movementsLink({ type: 'ADJUSTMENT', range: { from: today, to: today } })} />}>
              {t('supervision.live.alerts.viewAdjustments')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {purchaseCancellationCount > 0 && (
        <Alert>
          <AlertTitle>{t('supervision.live.alerts.purchaseCancellations', { count: purchaseCancellationCount })}</AlertTitle>
          <AlertAction>
            {/* The ledger lists their lines, each linked to its purchase. */}
            <Button size="sm" variant="outline" nativeButton={false}
              render={<Link to={movementsLink({ type: 'PURCHASE_CANCEL', range: { from: today, to: today } })} />}>
              {t('supervision.live.alerts.viewPurchaseCancellations')}
            </Button>
          </AlertAction>
        </Alert>
      )}
    </section>
  )
}

function SellersTable({ sellers, onView }: { sellers: SellerDay[]; onView: (drawer: CashDrawer) => void }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-4">{t('supervision.live.sellers.columns.seller')}</TableHead>
          <TableHead>{t('supervision.live.sellers.columns.drawer')}</TableHead>
          <TableHead className="hidden text-right sm:table-cell">{t('supervision.live.sellers.columns.tickets')}</TableHead>
          <TableHead className="text-right">{t('supervision.live.sellers.columns.sales')}</TableHead>
          <TableHead className="hidden text-right lg:table-cell">{t('sales.stats.averageTicket')}</TableHead>
          <TableHead className="hidden text-right md:table-cell">{t('supervision.live.sellers.columns.cancellations')}</TableHead>
          <TableHead className="hidden text-right sm:table-cell">{t('supervision.live.sellers.columns.net')}</TableHead>
          <TableHead className="hidden text-right md:table-cell">{t('supervision.live.sellers.columns.difference')}</TableHead>
          <TableHead className="w-12 pr-4"><span className="sr-only">{t('supervision.live.sellers.columns.actions')}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sellers.map(({ seller, drawer, amounts }) => {
          const cancellations = amounts?.cancellationCount ?? 0
          const difference = drawer?.closing?.difference
          return (
            <TableRow key={seller.id}>
              <TableCell className="pl-4 font-medium">
                <span className="flex flex-wrap items-center gap-2">{seller.name}{drawer && <SharedBadge drawer={drawer} />}</span>
              </TableCell>
              <TableCell>
                {drawer ? <DrawerStatus drawer={drawer} /> : <Badge variant="outline">{t('supervision.live.sellers.noDrawer')}</Badge>}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{amounts?.saleCount ?? 0}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(amounts?.salesTotal ?? 0)}</TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(averageTicket(amounts))}</TableCell>
              <TableCell className={cn('hidden text-right tabular-nums md:table-cell', cancellations > 0 && 'text-destructive')}>
                {cancellations > 0
                  ? t('supervision.live.sellers.cancellationsValue', {
                    count: cancellations, amount: formatMoney(amounts?.cancellationsTotal ?? 0),
                  })
                  : '—'}
              </TableCell>
              <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">{formatMoney(amounts?.net ?? 0)}</TableCell>
              <TableCell className={cn('hidden text-right md:table-cell', difference !== undefined && differenceClass(difference))}>
                {difference !== undefined ? formatMoney(difference) : '—'}
              </TableCell>
              <TableCell className="pr-4 text-right">
                {drawer && (
                  <Button variant="ghost" size="icon" onClick={() => onView(drawer)}
                    aria-label={t('supervision.live.sellers.view', { name: seller.name })}>
                    <Eye />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
