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
import { differenceClass, differenceLabel, formatTime } from '@/features/cash-drawer/format'
import { memberNames } from '@/features/cash-drawer/members'
import { type CashDrawer, useDayClosing, useStaleDrawers } from '@/features/cash-drawer/queries'
import { useLowStockCount } from '@/features/inventory/queries'
import { formatMoney } from '@/lib/money'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'

import { averageTicket, type SellerDay, sellerDays, type UnbalancedDrawer, unbalancedDrawers } from './live-day'

// Keep in step with supervision.live.updatedAt, which tells the user how often it refreshes.
const REFRESH_EVERY_MS = 60_000
const live = { refetchInterval: REFRESH_EVERY_MS }

// Managers' live view of the store's day; every figure and alert polls every REFRESH_EVERY_MS.
export function LivePage() {
  const { t, i18n } = useTranslation()
  const today = useToday()
  const day = useDayClosing(today, live)
  const staleDrawers = useStaleDrawers(today, live)
  const lowStock = useLowStockCount(live)
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
  const selected = [...drawers, ...(staleDrawers.data ?? [])].find((drawer) => drawer.id === selectedId) ?? null
  const fetching = day.isFetching || staleDrawers.isFetching || lowStock.isFetching
  const updatedAt = formatTime(new Date(day.dataUpdatedAt).toISOString(), i18n.language)
  const alertsError = staleDrawers.error ?? lowStock.error
  const view = (drawer: CashDrawer) => setSelectedId(drawer.id ?? null)

  function refresh() {
    void Promise.all([day.refetch(), staleDrawers.refetch(), lowStock.refetch()])
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
      ) : staleDrawers.data && lowStock.data !== undefined && (
        <Alerts stale={staleDrawers.data} unbalanced={unbalancedDrawers(drawers)} lowStockCount={lowStock.data} onView={view} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t('supervision.live.stats.sold')} value={formatMoney(total?.salesTotal ?? 0)}
          hint={t('supervision.live.stats.soldHint', { count: total?.saleCount ?? 0, average: formatMoney(averageTicket(total)) })} />
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

      <DrawerDetailDialog drawer={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  )
}

// Only what needs action; a quiet line when nothing does.
function Alerts({ stale, unbalanced, lowStockCount, onView }: {
  stale: CashDrawer[]
  unbalanced: UnbalancedDrawer[]
  lowStockCount: number
  onView: (drawer: CashDrawer) => void
}) {
  const { t } = useTranslation()
  if (stale.length === 0 && unbalanced.length === 0 && lowStockCount === 0) {
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
