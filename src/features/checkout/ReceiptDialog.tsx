import { useTranslation } from 'react-i18next'

import { PrintButton } from '@/components/PrintButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { dateLocale } from '@/i18n'
import { formatMoney } from '@/lib/money'

import type { Sale } from './queries'

// Shows the sale as the server recorded it (prices and VAT snapshots, server-side totals).
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
      {new Date(sale.saleDate!).toLocaleString(dateLocale(i18n.language))} · {sale.customer?.name}
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

// Paper ticket: store name, sale number and the same lines and totals as on screen.
export function ReceiptSlip({ sale }: { sale: Sale }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto grid max-w-xs gap-3">
      <div className="text-center">
        <p className="text-base font-semibold">{t('app.name')}</p>
        <p>{t('receipt.title', { number: sale.saleNumber })}</p>
        <p><ReceiptMeta sale={sale} /></p>
        {sale.status === 'CANCELLED' && <p className="font-semibold">{t('receipt.cancelledStamp')}</p>}
      </div>
      <ReceiptBody sale={sale} />
    </div>
  )
}
