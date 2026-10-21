import { useTranslation } from 'react-i18next'

import { PrintButton } from '@/components/PrintButton'
import { PrintDocument, PrintFields, PrintNotice, PrintTable, PrintTotals } from '@/components/PrintDocument'
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
import { formatMoney } from '@/lib/money'

import type { Sale } from './queries'

/** Shows the sale as the server recorded it (prices and VAT snapshots, server-side totals). */
export function ReceiptDialog({ sale, onClose, closeLabel }: {
  sale: Sale | null
  onClose: () => void
  closeLabel?: string
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {sale && (
          <>
            <DialogHeader>
              <DialogTitle>{t('receipt.title', { number: sale.saleNumber })}</DialogTitle>
              <DialogDescription>
                <ReceiptMeta sale={sale} />
              </DialogDescription>
            </DialogHeader>
            {sale.status === 'CANCELLED' && (
              <p className="text-sm font-medium text-destructive">
                {t('receipt.cancelled', { reason: sale.cancellation?.reason ?? '' })}
              </p>
            )}
            <ReceiptBody sale={sale} />
            <DialogFooter>
              <PrintButton label={t('receipt.print')} document={<ReceiptSlip sale={sale} />} />
              <Button onClick={onClose} autoFocus>{closeLabel ?? t('receipt.newSale')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReceiptMeta({ sale }: { sale: Sale }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      {formatDateTime(sale.saleDate, i18n.language)} · {sale.customer?.name}
      {' · '}{t(`checkout.paymentMethods.${sale.paymentMethod!}`)}
    </>
  )
}

function ReceiptBody({ sale }: { sale: Sale }) {
  const { t } = useTranslation()
  return (
    <>
      <ul className="grid gap-1 text-sm">
        {sale.items?.map((item) => (
          <li key={item.productId} className="flex justify-between gap-4">
            <span>{item.quantity} × {item.name}</span>
            <span className="tabular-nums">{formatMoney(item.subtotal!)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-y-1 border-t pt-3 text-sm">
        <dt className="text-muted-foreground">{t('checkout.subtotal')}</dt>
        <dd className="text-right tabular-nums">{formatMoney(sale.subtotal!)}</dd>
        <dt className="text-muted-foreground">{t('checkout.vat')}</dt>
        <dd className="text-right tabular-nums">{formatMoney(sale.tax!)}</dd>
        <dt className="font-semibold">{t('checkout.total')}</dt>
        <dd className="text-right font-semibold tabular-nums">{formatMoney(sale.total!)}</dd>
      </dl>
    </>
  )
}

/**
 * Printed receipt: who bought, who sold and how it was paid, the lines with their prices and VAT,
 * and the same server-side totals as on screen.
 */
export function ReceiptSlip({ sale }: { sale: Sale }) {
  const { t, i18n } = useTranslation()
  const when = (instant: string) => formatDateTime(instant, i18n.language, 'long')
  const items = sale.items ?? []
  const units = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const cancellation = sale.cancellation
  return (
    <PrintDocument kind={t('print.sale.kind')} folio={sale.saleNumber} date={when(sale.saleDate!)}
      notice={sale.status === 'CANCELLED' && (
        <PrintNotice title={t('print.sale.cancelled')}>
          {t('print.sale.cancelledDetail', {
            date: cancellation?.cancelledAt ? when(cancellation.cancelledAt) : '',
            name: cancellation?.cancelledBy?.name ?? '',
            reason: cancellation?.reason ?? '',
          })}
        </PrintNotice>
      )}>
      <PrintFields columns={4} fields={[
        [t('print.sale.customer'), sale.customer?.name],
        [t('print.sale.seller'), sale.seller?.name],
        [t('print.sale.payment'), t(`checkout.paymentMethods.${sale.paymentMethod!}`)],
        [t('print.status'), t(`sales.status.${sale.status!}`)],
      ]} />
      <PrintTable rows={items} rowKey={(item) => item.productId!} columns={[
        { header: t('print.columns.sku'), cell: (item) => item.sku, className: 'font-mono text-[8pt] text-slate-500' },
        { header: t('print.columns.product'), cell: (item) => item.name, className: 'font-medium text-slate-900' },
        { header: t('print.columns.quantity'), cell: (item) => item.quantity, numeric: true },
        { header: t('print.columns.unitPrice'), cell: (item) => formatMoney(item.unitPrice!), numeric: true },
        { header: t('print.columns.vat'), cell: (item) => `${Math.round((item.taxRate ?? 0) * 100)}%`, numeric: true },
        { header: t('print.columns.amount'), cell: (item) => formatMoney(item.subtotal!), numeric: true },
      ]} />
      <PrintTotals
        aside={<>
          <p>{t('print.items', { count: items.length, units })}</p>
          {sale.status !== 'CANCELLED' && <p className="mt-1 font-medium text-slate-700">{t('print.sale.thanks')}</p>}
        </>}
        rows={[
          { label: t('checkout.subtotal'), value: formatMoney(sale.subtotal!) },
          { label: t('checkout.vat'), value: formatMoney(sale.tax!) },
          { label: t('checkout.total'), value: formatMoney(sale.total!), grand: true },
        ]} />
    </PrintDocument>
  )
}
