import { Ban, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CancelSaleDialog } from '@/features/cash-drawer/DrawerSales'
import { useSale } from '@/features/cash-drawer/queries'
import { ReceiptSlip } from '@/features/checkout/ReceiptDialog'
import { formatTaxRate } from '@/features/products/tax-rate'
import { dateLocale } from '@/i18n'
import { formatMoney } from '@/lib/money'

/**
 * A sale as the server recorded it: price and VAT of every line, who sold it and, when cancelled,
 * who cancelled it and why. Managers can cancel it from here.
 */
export function SaleDetailDialog({ saleId, canCancel, onClose }: {
  saleId: number | null
  canCancel: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const sale = useSale(saleId)
  const [cancelling, setCancelling] = useState(false)
  const when = new Intl.DateTimeFormat(dateLocale(i18n.language), { dateStyle: 'medium', timeStyle: 'short' })
  const data = sale.data
  const cancelled = data?.status === 'CANCELLED'

  return (
    <>
      <Dialog open={saleId !== null && !cancelling} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="flex-row items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="size-5" />
            </span>
            <span className="grid min-w-0 gap-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                {t('receipt.title', { number: data?.saleNumber ?? '' })}
                {cancelled && <Badge variant="destructive">{t('sales.status.CANCELLED')}</Badge>}
              </DialogTitle>
              <DialogDescription className="truncate">
                {data ? when.format(new Date(data.saleDate!)) : `${t('app.loading')}…`}
              </DialogDescription>
            </span>
          </DialogHeader>
          {sale.isError && <ErrorAlert message={errorMessage(sale.error)} />}
          {sale.isPending && saleId !== null && <div className="h-40 animate-pulse rounded-lg bg-muted/60" />}
          {data && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t('sales.columns.customer')}</dt>
                  <dd className="truncate">{data.customer?.name}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t('sales.columns.seller')}</dt>
                  <dd className="truncate">{data.seller?.name}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t('sales.columns.payment')}</dt>
                  <dd>{t(`checkout.paymentMethods.${data.paymentMethod!}`)}</dd>
                </div>
              </dl>
              {cancelled && data.cancellation && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    {t('sales.detail.cancelledBy', {
                      name: data.cancellation.cancelledBy?.name,
                      date: when.format(new Date(data.cancellation.cancelledAt!)),
                    })}
                  </p>
                  <p className="text-muted-foreground">{t('sales.detail.reason', { reason: data.cancellation.reason })}</p>
                </div>
              )}
              <div className="max-h-[40svh] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-3">{t('sales.detail.product')}</TableHead>
                      <TableHead className="text-right">{t('sales.detail.quantity')}</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">{t('sales.detail.unitPrice')}</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">{t('sales.detail.vat')}</TableHead>
                      <TableHead className="pr-3 text-right">{t('sales.detail.amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items?.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell className="pl-3">
                          <span className="grid">
                            <span className="font-medium">{item.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatMoney(item.unitPrice!)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          <span className="grid">
                            {formatMoney(item.tax!)}
                            <span className="text-xs text-muted-foreground">{formatTaxRate(item.taxRate!, i18n.language)}</span>
                          </span>
                        </TableCell>
                        <TableCell className="pr-3 text-right tabular-nums">{formatMoney(item.subtotal!)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t('checkout.subtotal')}</dt>
                <dd className="text-right tabular-nums">{formatMoney(data.subtotal!)}</dd>
                <dt className="text-muted-foreground">{t('checkout.vat')}</dt>
                <dd className="text-right tabular-nums">{formatMoney(data.tax!)}</dd>
                <dt className="font-semibold">{t('checkout.total')}</dt>
                <dd className="text-right font-semibold tabular-nums">{formatMoney(data.total!)}</dd>
              </dl>
              <DialogFooter>
                {canCancel && !cancelled && (
                  <Button variant="outline" className="text-destructive hover:text-destructive sm:mr-auto" onClick={() => setCancelling(true)}>
                    <Ban />
                    {t('sales.detail.cancel')}
                  </Button>
                )}
                <PrintButton label={t('receipt.print')} document={<ReceiptSlip sale={data} />} />
                <Button onClick={onClose}>{t('app.close')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* The detail hides while this is open and comes back after cancelling (showing the cancellation) or keeping the sale. */}
      <CancelSaleDialog sale={cancelling && data ? data : null} onOpenChange={(open) => !open && setCancelling(false)} />
    </>
  )
}
