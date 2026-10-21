import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  PackageMinus,
  PackagePlus,
  type LucideIcon,
  TriangleAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { dateLocale } from '@/i18n'
import { type PurchaseReport, usePurchaseReport } from '@/features/purchases/queries'
import { formatMoney, fromCents, toCents } from '@/lib/money'
import { cn } from '@/lib/utils'

import { lastDaysRange } from './days'
import { moneySeries } from './money-series'
import { MoneyChart } from './MoneyChart'
import {
  type LowStockProduct,
  type PurchaseSummary,
  type SaleReport,
  type SaleSummary,
  useLowStock,
  useRecentPurchases,
  useRecentSales,
  useSaleReport,
} from './queries'

const periods = [7, 30, 90] as const
type Period = (typeof periods)[number]

/**
 * The last 7, 30 or 90 days (charted per week for 90): sales, payment methods, top products, low
 * stock and the latest movements. Managers also see purchases and the net flow; sellers the average ticket.
 */
export function DashboardPage() {
  const { t } = useTranslation()
  const { role } = useUser()
  const isManager = managesStore(role)
  const [period, setPeriod] = useState<Period>(30)
  const range = useMemo(() => lastDaysRange(period), [period])

  const report = useSaleReport(range)
  const purchases = usePurchaseReport(range, null, isManager)
  const recentPurchases = useRecentPurchases(range, isManager)
  const recentSales = useRecentSales(range)
  const lowStock = useLowStock()
  // Low stock is left out: its card shows its own error.
  const error = report.error ?? purchases.error ?? recentSales.error ?? recentPurchases.error

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
        </div>
        <div role="group" aria-label={t('dashboard.period')} className="flex rounded-lg bg-muted p-1">
          {periods.map((days) => (
            <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)}
              className={cn(
                'h-8 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors outline-none',
                'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                period === days && 'bg-background text-foreground shadow-sm',
              )}>
              {t('dashboard.lastDays', { count: days })}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorAlert message={errorMessage(error)} />}

      <KpiTiles report={report.data} purchases={isManager ? purchases.data : undefined} isManager={isManager} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t(isManager ? 'dashboard.moneyChart' : 'dashboard.salesChart')}</CardTitle>
            <CardDescription>{t(period === 90 ? 'dashboard.perWeek' : 'dashboard.perDay')}</CardDescription>
          </CardHeader>
          <CardContent>
            {report.data ? (
              <MoneyChart showPurchases={isManager}
                data={moneySeries(range, report.data.byDay ?? [], purchases.data?.byDay ?? [], period === 90 ? 7 : 1)} />
            ) : (
              <ChartPlaceholder />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.paymentMethods')}</CardTitle>
            <CardDescription>{t('dashboard.paymentMethodsHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethods report={report.data} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.topProducts')}</CardTitle>
            <CardDescription>{t('dashboard.topProductsHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProducts report={report.data} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.lowStock')}</CardTitle>
            <CardDescription>{t('dashboard.lowStockHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.isError ? (
              <p className="text-sm text-destructive">{errorMessage(lowStock.error)}</p>
            ) : (
              <LowStock products={lowStock.data?.content} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recent')}</CardTitle>
          <CardDescription>{t(isManager ? 'dashboard.recentHint' : 'dashboard.recentSalesHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sellers pass [] because their disabled purchases query never loads and would keep the placeholder up. */}
          <RecentMovements sales={recentSales.data} purchases={isManager ? recentPurchases.data : []} />
        </CardContent>
      </Card>
    </div>
  )
}

function KpiTiles({ report, purchases, isManager }: {
  report?: SaleReport
  purchases?: PurchaseReport
  isManager: boolean
}) {
  const { t } = useTranslation()
  const sales = report?.completed?.total
  const saleCount = report?.completed?.saleCount ?? 0
  const spent = purchases?.total

  const tiles: { label: string; value?: number; hint: string; signed?: boolean }[] = [
    {
      label: t('dashboard.sales'),
      value: sales,
      hint: t('dashboard.salesCount', { count: saleCount }),
    },
    ...(isManager
      ? [
          {
            label: t('dashboard.purchases'),
            value: spent,
            hint: t('dashboard.purchasesCount', { count: purchases?.purchaseCount ?? 0 }),
          },
          {
            label: t('dashboard.netFlow'),
            value: sales !== undefined && spent !== undefined ? fromCents(toCents(sales) - toCents(spent)) : undefined,
            hint: t('dashboard.netFlowHint'),
            signed: true,
          },
        ]
      : [
          {
            label: t('dashboard.averageTicket'),
            value: report?.averageTicket,
            hint: t('dashboard.averageTicketHint'),
          },
        ]),
    {
      label: t('dashboard.cancellations'),
      value: report?.cancelled?.total,
      hint: t('dashboard.cancellationsCount', { count: report?.cancelled?.saleCount ?? 0 }),
    },
  ]

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', isManager ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
      {tiles.map((tile) => (
        <Card key={tile.label} size="sm">
          <CardContent className="grid gap-1">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            {tile.value === undefined ? (
              <span className="my-1 h-7 w-28 animate-pulse rounded-md bg-muted" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {tile.signed && tile.value > 0 && '+'}
                {formatMoney(tile.value)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{tile.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChartPlaceholder() {
  return <div className="h-[260px] animate-pulse rounded-lg bg-muted/60" />
}

/**
 * Horizontal bars sharing one scale, with the value written next to each bar; a placeholder while
 * rows is undefined.
 */
function BarList({ rows, emptyText }: {
  rows?: { key: string | number; label: string; value: number; display: string; detail?: string }[]
  emptyText: string
}) {
  if (!rows) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
  }
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
  }
  const max = Math.max(...rows.map((row) => row.value), 0)

  return (
    <ul className="grid gap-3.5">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {row.display}
              {row.detail && <span className="ml-1.5 font-normal text-muted-foreground">{row.detail}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            {/* At least 2% wide, so the smallest values still show a sliver. */}
            <div className="h-full rounded-full bg-chart-1"
              style={{ width: max > 0 ? `${Math.max((row.value / max) * 100, 2)}%` : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PaymentMethods({ report }: { report?: SaleReport }) {
  const { t } = useTranslation()
  const methods = report?.byPaymentMethod?.filter((method) => (method.saleCount ?? 0) > 0)
  const total = methods?.reduce((sum, method) => sum + (method.total ?? 0), 0) ?? 0

  return (
    <BarList emptyText={t('dashboard.noSales')}
      rows={methods?.map((method) => ({
        key: method.paymentMethod ?? '',
        label: t(`checkout.paymentMethods.${method.paymentMethod ?? 'CASH'}`),
        value: method.total ?? 0,
        display: formatMoney(method.total ?? 0),
        detail: total > 0 ? `${Math.round(((method.total ?? 0) / total) * 100)}%` : undefined,
      }))} />
  )
}

function TopProducts({ report }: { report?: SaleReport }) {
  const { t } = useTranslation()

  return (
    <BarList emptyText={t('dashboard.noSales')}
      rows={report?.topProducts?.slice(0, 6).map((product) => ({
        key: product.productId ?? product.name ?? '',
        label: product.name ?? '',
        value: product.quantity ?? 0,
        display: t('dashboard.units', { count: product.quantity ?? 0 }),
        detail: formatMoney(product.subtotal ?? 0),
      }))} />
  )
}

function LowStock({ products }: { products?: LowStockProduct[] }) {
  const { t } = useTranslation()

  if (!products) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
  }
  if (products.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('dashboard.lowStockEmpty')}</p>
  }
  return (
    <ul className="grid gap-3.5">
      {products.map((product) => {
        const stock = product.stock ?? 0
        const min = product.minStock ?? 0
        return (
          <li key={product.productId} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{product.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
                <TriangleAlert className="size-3.5" />
                {stock === 0 ? t('dashboard.outOfStock') : t('dashboard.shortBy', { count: product.shortage ?? 0 })}
              </span>
            </div>
            {/* Stock against its minimum: a full bar means the product reached its minimum. */}
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70"
                  style={{ width: min > 0 ? `${Math.min((stock / min) * 100, 100)}%` : 0 }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {t('dashboard.stockOfMin', { stock, min })}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

interface Movement {
  key: string
  date: string
  title: string
  detail: string
  amount: number
  icon: LucideIcon
  stockIcon: LucideIcon
  stockLabel: string
  cancelled?: boolean
}

/** Sales and purchases merged, newest first, eight at most; a placeholder until both lists arrive. */
function RecentMovements({ sales, purchases }: { sales?: SaleSummary[]; purchases?: PurchaseSummary[] }) {
  const { t, i18n } = useTranslation()

  if (!sales || !purchases) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
  }

  // 8 is RECENT_COUNT in queries.ts: each list brings only its newest 8, so showing more could leave gaps.
  const movements: Movement[] = [
    ...sales.map((sale): Movement => ({
      key: `sale-${sale.id}`,
      date: sale.saleDate ?? '',
      title: t('dashboard.movement.sale', { number: sale.saleNumber }),
      detail: [t(`checkout.paymentMethods.${sale.paymentMethod ?? 'CASH'}`), sale.seller?.name].filter(Boolean).join(' · '),
      amount: sale.total ?? 0,
      icon: sale.status === 'CANCELLED' ? Ban : ArrowDownLeft,
      // A cancelled sale put its units back.
      stockIcon: sale.status === 'CANCELLED' ? PackagePlus : PackageMinus,
      stockLabel: t(sale.status === 'CANCELLED' ? 'dashboard.movement.stockReturned' : 'dashboard.movement.stockOut'),
      cancelled: sale.status === 'CANCELLED',
    })),
    ...purchases.map((purchase): Movement => ({
      key: `purchase-${purchase.id}`,
      date: purchase.purchaseDate ?? '',
      title: t('dashboard.movement.purchase', { supplier: purchase.supplier?.name ?? '' }),
      detail: purchase.recordedBy?.name ?? '',
      amount: -(purchase.total ?? 0),
      icon: ArrowUpRight,
      stockIcon: PackagePlus,
      stockLabel: t('dashboard.movement.stockIn'),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  if (movements.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('dashboard.recentEmpty')}</p>
  }

  const when = new Intl.DateTimeFormat(dateLocale(i18n.language), { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <ul className="divide-y">
      {movements.map(({ key, date, title, detail, amount, icon: Icon, stockIcon: StockIcon, stockLabel, cancelled }) => (
        <li key={key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{title}</span>
              {cancelled && <Badge variant="outline">{t('dashboard.movement.cancelled')}</Badge>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[when.format(new Date(date)), detail].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="grid shrink-0 justify-items-end gap-0.5">
            <span className={cn('text-sm font-medium tabular-nums', cancelled && 'text-muted-foreground line-through')}>
              {amount > 0 ? '+' : '−'}
              {formatMoney(Math.abs(amount))}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <StockIcon className="size-3.5" />
              {stockLabel}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
