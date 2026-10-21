import { Ban, Eye } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { LoadingBlock } from '@/components/LoadingBlock'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SaleDetailDialog } from '@/features/sales/SaleDetailDialog'
import type { useDayCancellations } from '@/features/sales/queries'
import { formatDate, formatTime } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'

import { earlierSaleDay } from './live-day'

/** Who cancelled what today and why, last first; a click opens the ticket. */
export function CancellationsCard({ cancellations, today }: {
  cancellations: ReturnType<typeof useDayCancellations>
  today: string
}) {
  const { t, i18n } = useTranslation()
  const [viewing, setViewing] = useState<number | null>(null)
  const sales = cancellations.data?.content ?? []
  const count = cancellations.data?.page?.totalElements ?? 0

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>{t('supervision.live.cancellations.title')}</CardTitle>
        <CardDescription>{t('supervision.live.cancellations.description')}</CardDescription>
      </CardHeader>
      {/* The day's figures refresh apart, so a failed refresh here must say the list is older than they are. */}
      {cancellations.isRefetchError && (
        <div className="border-b p-4">
          <Alert variant="destructive">
            <AlertTitle>
              {t('supervision.live.refreshFailed', {
                time: formatTime(cancellations.dataUpdatedAt, i18n.language),
              })}
            </AlertTitle>
            <AlertDescription>{errorMessage(cancellations.error)}</AlertDescription>
          </Alert>
        </div>
      )}
      {cancellations.isPending ? (
        <LoadingBlock />
      ) : cancellations.isLoadingError ? (
        <div className="p-4"><ErrorAlert message={errorMessage(cancellations.error)} /></div>
      ) : sales.length === 0 ? (
        <EmptyState icon={Ban} text={t('supervision.live.cancellations.empty')} />
      ) : (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">{t('supervision.live.cancellations.columns.time')}</TableHead>
              <TableHead>{t('supervision.live.cancellations.columns.ticket')}</TableHead>
              <TableHead className="hidden sm:table-cell">{t('supervision.live.cancellations.columns.seller')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('supervision.live.cancellations.columns.cancelledBy')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('supervision.live.cancellations.columns.reason')}</TableHead>
              <TableHead className="text-right">{t('supervision.live.cancellations.columns.amount')}</TableHead>
              <TableHead className="w-12 pr-4"><span className="sr-only">{t('supervision.live.cancellations.columns.actions')}</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => {
              const soldOn = earlierSaleDay(sale, today)
              return (
                <TableRow key={sale.id} className="cursor-pointer" onClick={() => setViewing(sale.id!)}>
                  <TableCell className="pl-4 tabular-nums">
                    {sale.cancellation?.cancelledAt && formatTime(sale.cancellation.cancelledAt, i18n.language)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">#{sale.saleNumber}</span>
                      {soldOn && (
                        <Badge variant="outline">
                          {t('supervision.live.cancellations.soldOn', { date: formatDate(soldOn, i18n.language) })}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{sale.seller?.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{sale.cancellation?.cancelledBy?.name}</TableCell>
                  <TableCell className="hidden max-w-64 truncate md:table-cell" title={sale.cancellation?.reason}>
                    {sale.cancellation?.reason}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-destructive">{formatMoney(sale.total ?? 0)}</TableCell>
                  <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="icon" aria-label={t('drawer.viewTicket', { number: sale.saleNumber })}
                      onClick={() => setViewing(sale.id!)}>
                      <Eye />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {count > sales.length && (
        <CardFooter className="border-t py-3 text-sm text-muted-foreground">
          {t('supervision.live.cancellations.more', { shown: sales.length, count })}
        </CardFooter>
      )}

      <SaleDetailDialog saleId={viewing} canCancel={false} onClose={() => setViewing(null)} />
    </Card>
  )
}
