import { Eye, FileSpreadsheet, Printer, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { StatTile } from '@/components/StatTile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DrawerDetailDialog } from '@/features/cash-drawer/DrawerDetailDialog'
import { DrawerStatus, SharedBadge } from '@/features/cash-drawer/DrawerParts'
import { differenceClass } from '@/features/cash-drawer/format'
import { memberNames } from '@/features/cash-drawer/members'
import { type CashClosing, type CashDrawer, useDayClosing } from '@/features/cash-drawer/queries'
import { useSellerOptions } from '@/features/sales/use-seller-options'
import { formatDate } from '@/lib/date-format'
import { downloadWorkbook } from '@/lib/excel'
import { formatMoney } from '@/lib/money'
import { useReportMeta } from '@/lib/report-meta'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'

import { CashClosingDocument } from './CashClosingDocument'
import { closingFigures, PAYMENT_METHODS } from './closing-data'
import { cashClosingWorkbook } from './reports-excel'

const ALL = 'all'

/**
 * The store's closing for any day (or one seller's): sales and cancellations by payment method and
 * seller, the cash the drawers should hold and what was counted in each one.
 */
export function CashClosingReportPage() {
  const { t, i18n } = useTranslation()
  const today = useToday()
  const [date, setDate] = useState(today)
  const [sellerId, setSellerId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<CashDrawer | null>(null)
  const [exporting, setExporting] = useState(false)
  const closing = useDayClosing(date, { sellerId: sellerId ?? undefined })
  const sellers = useSellerOptions()
  const reportMeta = useReportMeta()

  const seller = sellers.find((option) => option.id === sellerId)
  const sellerLabel = seller?.name ?? t('sales.filters.allSellers')
  const dateLabel = formatDate(date, i18n.language, 'long')
  const status = closing.data?.closed ? t('reports.closing.dayClosed') : t('reports.closing.dayInProgress')

  async function exportExcel() {
    if (!closing.data) {
      return
    }
    setExporting(true)
    try {
      await downloadWorkbook(`${t('excel.files.cashClosing')}_${date}`,
        cashClosingWorkbook({ t, closing: closing.data, date: dateLabel, seller: sellerLabel, status }), reportMeta)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <Label htmlFor="closing-date">{t('reports.closing.date')}</Label>
            <Input id="closing-date" type="date" value={date} max={today} className="h-9 w-40"
              onChange={(event) => event.target.value && setDate(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="closing-seller">{t('sales.columns.seller')}</Label>
            <Select id="closing-seller" className="h-9 w-52" value={sellerId === null ? ALL : String(sellerId)}
              onValueChange={(value) => setSellerId(!value || value === ALL ? null : Number(value))}
              options={[
                { value: ALL, label: t('sales.filters.allSellers') },
                ...sellers.map((option) => ({ value: String(option.id), label: option.name })),
              ]} />
          </div>
          {closing.data && (
            <Badge variant={closing.data.closed ? 'secondary' : 'outline'} className="mb-2">{status}</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {closing.data ? (
            <PrintButton label={t('reports.print')} document={
              <CashClosingDocument closing={closing.data} date={dateLabel} seller={sellerLabel} status={status} />
            } />
          ) : (
            <Button variant="outline" disabled><Printer />{t('reports.print')}</Button>
          )}
          <Button variant="outline" disabled={exporting || !closing.data} onClick={() => void exportExcel()}>
            <FileSpreadsheet />
            {exporting ? t('excel.exporting') : t('reports.export')}
          </Button>
        </div>
      </div>

      {closing.data && !closing.data.closed && (
        <p className="-mt-3 text-xs text-muted-foreground">{t('reports.closing.inProgressHint')}</p>
      )}
      {closing.isError && <ErrorAlert message={errorMessage(closing.error)} />}

      <ClosingTiles closing={closing.data} />

      <div className="grid gap-6 xl:grid-cols-2">
        <MethodsCard closing={closing.data} />
        <SellersCard closing={closing.data} />
      </div>

      <DrawersCard closing={closing.data} onView={setViewing} />

      <DrawerDetailDialog drawer={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </div>
  )
}

function ClosingTiles({ closing }: { closing?: CashClosing }) {
  const { t } = useTranslation()
  const figures = closing && closingFigures(closing)
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile label={t('reports.closing.metrics.net')} value={figures && formatMoney(figures.net)}
        hint={figures && t('reports.closing.netDetail', {
          sales: formatMoney(figures.sales), cancellations: formatMoney(figures.cancellations),
        })} />
      <StatTile label={t('reports.closing.metrics.expected')} value={figures && formatMoney(figures.expected)}
        hint={figures && t('reports.closing.expectedDetail', { floats: formatMoney(figures.floats), cash: formatMoney(figures.cashNet) })} />
      <StatTile label={t('reports.closing.metrics.counted')} value={figures && formatMoney(figures.counted)}
        hint={figures && t('reports.closing.closedDrawers', { count: figures.closedCount, total: figures.drawerCount })} />
      <StatTile label={t('reports.closing.metrics.difference')}
        value={figures && <span className={differenceClass(figures.difference)}>{formatMoney(figures.difference)}</span>}
        hint={t('reports.closing.metrics.differenceHint')} />
    </div>
  )
}

function Skeleton() {
  return <CardContent className="pb-6"><div className="h-40 animate-pulse rounded-lg bg-muted/60" /></CardContent>
}

function MethodsCard({ closing }: { closing?: CashClosing }) {
  const { t } = useTranslation()
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('reports.closing.byMethod')}</CardTitle>
        <CardDescription>{t('reports.closing.byMethodHint')}</CardDescription>
      </CardHeader>
      {!closing ? <Skeleton /> : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t('sales.columns.payment')}</TableHead>
              <TableHead className="text-right">{t('print.closing.sales')}</TableHead>
              <TableHead className="text-right">{t('print.closing.cancellations')}</TableHead>
              <TableHead className="pr-4 text-right">{t('print.closing.net')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PAYMENT_METHODS.map((method) => {
              const amounts = closing.byPaymentMethod?.[method]
              return (
                <TableRow key={method}>
                  <TableCell className="pl-4 font-medium">{t(`checkout.paymentMethods.${method}`)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(amounts?.salesTotal ?? 0)}
                    <span className="block text-xs text-muted-foreground">{t('reports.closing.salesCount', { count: amounts?.saleCount ?? 0 })}</span>
                  </TableCell>
                  <TableCell className={cn('text-right tabular-nums', (amounts?.cancellationCount ?? 0) > 0 && 'text-destructive')}>
                    {(amounts?.cancellationCount ?? 0) > 0 ? `−${formatMoney(amounts?.cancellationsTotal ?? 0)}` : '—'}
                    {(amounts?.cancellationCount ?? 0) > 0 && (
                      <span className="block text-xs">{t('reports.closing.cancellationsCount', { count: amounts?.cancellationCount ?? 0 })}</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-medium tabular-nums">{formatMoney(amounts?.net ?? 0)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="pl-4">{t('drawer.netTotal')}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(closing.total?.salesTotal ?? 0)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {(closing.total?.cancellationCount ?? 0) > 0 ? `−${formatMoney(closing.total?.cancellationsTotal ?? 0)}` : '—'}
              </TableCell>
              <TableCell className="pr-4 text-right tabular-nums">{formatMoney(closing.total?.net ?? 0)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </Card>
  )
}

function SellersCard({ closing }: { closing?: CashClosing }) {
  const { t } = useTranslation()
  const sellers = closing?.bySeller ?? []
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('reports.closing.bySeller')}</CardTitle>
        <CardDescription>{t('reports.closing.bySellerHint')}</CardDescription>
      </CardHeader>
      {!closing ? <Skeleton /> : sellers.length === 0 ? (
        <p className="px-4 pb-10 text-center text-sm text-muted-foreground">{t('drawer.noSales')}</p>
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t('sales.columns.seller')}</TableHead>
              <TableHead className="text-right">{t('print.closing.sales')}</TableHead>
              <TableHead className="text-right">{t('reports.closing.cashNet')}</TableHead>
              <TableHead className="pr-4 text-right">{t('print.closing.net')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map(({ seller, cash, total }) => (
              <TableRow key={seller?.id}>
                <TableCell className="max-w-44 truncate pl-4 font-medium">{seller?.name}</TableCell>
                <TableCell className="text-right tabular-nums">{total?.saleCount ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(cash?.net ?? 0)}</TableCell>
                <TableCell className="pr-4 text-right font-medium tabular-nums">{formatMoney(total?.net ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function DrawersCard({ closing, onView }: { closing?: CashClosing; onView: (drawer: CashDrawer) => void }) {
  const { t } = useTranslation()
  const drawers = closing?.drawers ?? []
  const figures = closing && closingFigures(closing)
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t('reports.closing.drawers')}</CardTitle>
        <CardDescription>{t('reports.closing.drawersHint')}</CardDescription>
      </CardHeader>
      {!closing ? <Skeleton /> : drawers.length === 0 ? (
        <EmptyState icon={Wallet} text={t('reports.closing.noDrawers')} />
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t('drawer.columns.seller')}</TableHead>
              <TableHead>{t('drawer.columns.status')}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t('drawer.columns.float')}</TableHead>
              <TableHead className="hidden text-right md:table-cell">{t('drawer.expectedCash')}</TableHead>
              <TableHead className="hidden text-right md:table-cell">{t('drawer.countedCash')}</TableHead>
              <TableHead className="text-right">{t('drawer.columns.difference')}</TableHead>
              <TableHead className="w-12 pr-4"><span className="sr-only">{t('drawer.columns.actions')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drawers.map((drawer) => (
              <TableRow key={drawer.id}>
                <TableCell className="pl-4 font-medium">
                  <span className="flex flex-wrap items-center gap-2">{memberNames(drawer)}<SharedBadge drawer={drawer} /></span>
                </TableCell>
                <TableCell><DrawerStatus drawer={drawer} /></TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(drawer.openingFloat ?? 0)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {drawer.closing ? formatMoney(drawer.closing.expectedCash ?? 0) : '—'}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {drawer.closing ? formatMoney(drawer.closing.countedCash ?? 0) : '—'}
                </TableCell>
                <TableCell className={cn('text-right font-medium', drawer.closing && differenceClass(drawer.closing.difference ?? 0))}>
                  {drawer.closing ? formatMoney(drawer.closing.difference ?? 0) : '—'}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button variant="ghost" size="icon" onClick={() => onView(drawer)}
                    aria-label={t('drawer.today.view', { name: memberNames(drawer) })}>
                    <Eye />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {figures && (
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4" colSpan={2}>{t('excel.total')}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(figures.floats)}</TableCell>
                {/* Closed drawers only, like counted and difference; the day's whole expected cash is in the tiles. */}
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(figures.closedExpected)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatMoney(figures.counted)}</TableCell>
                <TableCell className={cn('text-right', differenceClass(figures.difference))}>{formatMoney(figures.difference)}</TableCell>
                <TableCell className="pr-4" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      )}
    </Card>
  )
}
