import { Copy, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { PrintDocument, PrintFields, PrintSection, PrintSignatures, PrintTable, PrintTotals } from '@/components/PrintDocument'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { intlLocale } from '@/i18n/intl-locale'
import { formatMoney } from '@/lib/money'

import type { DraftState } from './purchase-draft'
import { type Purchase, usePurchase } from './queries'

/** A recorded purchase with its lines as the server stored them; it can be printed or repeated. */
export function PurchaseDetailDialog({ purchaseId, onClose }: { purchaseId: number | null; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const purchase = usePurchase(purchaseId)

  // Same supplier, products, quantities and costs, ready to change before recording it.
  function repeat(data: Purchase) {
    const state: DraftState = {
      supplier: { id: data.supplier!.id!, name: data.supplier!.name! },
      lines: data.items!.map((item) => ({
        productId: item.productId!, sku: item.sku!, name: item.name!,
        quantity: String(item.quantity), unitCost: String(item.unitCost),
      })),
    }
    onClose()
    void navigate('/purchases/new', { state })
  }

  return (
    <Dialog open={purchaseId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="flex-row items-center gap-3 pr-8">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Truck className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <DialogTitle className="text-lg">{t('purchases.detail.title', { id: purchaseId })}</DialogTitle>
            <DialogDescription className="truncate">
              {purchase.data ? <PurchaseMeta purchase={purchase.data} /> : `${t('app.loading')}…`}
            </DialogDescription>
          </span>
        </DialogHeader>
        {purchase.isError && <ErrorAlert message={errorMessage(purchase.error)} />}
        {/* A disabled query is pending too, so no skeleton once the id is cleared and the dialog closes. */}
        {purchase.isPending && purchaseId !== null && <div className="h-40 animate-pulse rounded-lg bg-muted/60" />}
        {purchase.data && (
          <>
            <div className="max-h-[50svh] overflow-y-auto rounded-lg border">
              <PurchaseLines purchase={purchase.data} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => repeat(purchase.data)}>
                <Copy />
                {t('purchases.detail.repeat')}
              </Button>
              <PrintButton label={t('purchases.detail.print')} document={<PurchaseSlip purchase={purchase.data} />} />
              <Button onClick={onClose}>{t('app.close')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PurchaseMeta({ purchase }: { purchase: Purchase }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      {purchase.supplier?.name} · {new Date(purchase.purchaseDate!).toLocaleString(intlLocale(i18n.language))}
      {' · '}{t('purchases.detail.recordedBy', { name: purchase.recordedBy?.name })}
    </>
  )
}

function PurchaseLines({ purchase }: { purchase: Purchase }) {
  const { t } = useTranslation()
  const units = purchase.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0
  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-3">{t('purchases.columns.product')}</TableHead>
          <TableHead className="text-right">{t('purchases.columns.quantity')}</TableHead>
          <TableHead className="text-right">{t('purchases.columns.unitCost')}</TableHead>
          <TableHead className="pr-3 text-right">{t('purchases.columns.subtotal')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchase.items?.map((item) => (
          <TableRow key={item.productId}>
            <TableCell className="pl-3">
              <span className="grid">
                <span className="font-medium">{item.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(item.unitCost!)}</TableCell>
            <TableCell className="pr-3 text-right tabular-nums">{formatMoney(item.subtotal!)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="pl-3 font-semibold">{t('purchases.detail.total')}</TableCell>
          <TableCell className="text-right text-muted-foreground tabular-nums">
            {t('purchases.detail.units', { count: units })}
          </TableCell>
          <TableCell />
          <TableCell className="pr-3 text-right font-semibold tabular-nums">{formatMoney(purchase.total!)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

/**
 * Printed receipt of the stock in: supplier, lines and totals, with lines to sign for who delivered
 * and who received it.
 */
function PurchaseSlip({ purchase }: { purchase: Purchase }) {
  const { t, i18n } = useTranslation()
  const items = purchase.items ?? []
  const units = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  const date = new Date(purchase.purchaseDate!).toLocaleString(intlLocale(i18n.language),
    { dateStyle: 'long', timeStyle: 'short' })
  return (
    <PrintDocument kind={t('print.purchase.kind')} folio={purchase.id} date={date}>
      <PrintFields columns={2} fields={[
        [t('print.purchase.supplier'), purchase.supplier?.name],
        [t('print.purchase.recordedBy'), purchase.recordedBy?.name],
      ]} />
      <PrintSection title={t('print.purchase.lines')}>
        <PrintTable rows={items} rowKey={(item) => item.productId!} columns={[
          { header: t('print.columns.sku'), cell: (item) => item.sku, className: 'font-mono text-[8pt] text-slate-500' },
          { header: t('print.columns.product'), cell: (item) => item.name, className: 'font-medium text-slate-900' },
          { header: t('print.columns.quantity'), cell: (item) => item.quantity, numeric: true },
          { header: t('print.columns.unitCost'), cell: (item) => formatMoney(item.unitCost!), numeric: true },
          { header: t('print.columns.amount'), cell: (item) => formatMoney(item.subtotal!), numeric: true },
        ]} />
      </PrintSection>
      <PrintTotals
        aside={t('print.items', { count: items.length, units })}
        rows={[{ label: t('purchases.detail.total'), value: formatMoney(purchase.total!), grand: true }]} />
      <PrintSignatures signers={[
        { label: t('purchases.detail.deliveredBy'), name: purchase.supplier?.name },
        { label: t('purchases.detail.receivedBy'), name: purchase.recordedBy?.name },
      ]} />
    </PrintDocument>
  )
}
