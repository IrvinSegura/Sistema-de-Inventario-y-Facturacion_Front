import { Ban, Copy, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PrintButton } from '@/components/PrintButton'
import { PrintDocument, PrintFields, PrintSection, PrintSignatures, PrintTable, PrintTotals } from '@/components/PrintDocument'
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'

import { CancelPurchaseDialog } from './CancelPurchaseDialog'
import type { DraftState } from './purchase-draft'
import { type Purchase, usePurchase } from './queries'

/**
 * A recorded purchase with its lines as the server stored them and, when cancelled, who cancelled it
 * and why. It can be printed, repeated or cancelled.
 */
export function PurchaseDetailDialog({ purchaseId, onClose }: { purchaseId: number | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const purchase = usePurchase(purchaseId)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const cancelled = purchase.data?.status === 'CANCELLED'
  const cancellation = cancelled ? purchase.data?.cancellation : undefined

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
    <>
      <Dialog open={purchaseId !== null && !cancelDialogOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="flex-row items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="size-5" />
            </span>
            <span className="grid min-w-0 gap-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                {t('purchases.detail.title', { id: purchaseId })}
                {cancelled && <Badge variant="destructive">{t('purchases.status.CANCELLED')}</Badge>}
              </DialogTitle>
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
              {cancellation && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">
                    {t('purchases.detail.cancelledBy', {
                      name: cancellation.cancelledBy?.name,
                      date: formatDateTime(cancellation.cancelledAt, i18n.language),
                    })}
                  </p>
                  <p className="text-muted-foreground">{t('purchases.detail.reason', { reason: cancellation.reason })}</p>
                </div>
              )}
              <div className="max-h-[50svh] overflow-y-auto rounded-lg border">
                <PurchaseLines purchase={purchase.data} />
              </div>
              <DialogFooter>
                {!cancelled && (
                  <Button variant="outline" className="text-destructive hover:text-destructive sm:mr-auto" onClick={() => setCancelDialogOpen(true)}>
                    <Ban />
                    {t('purchases.detail.cancel')}
                  </Button>
                )}
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
      {/* The detail hides while the cancel dialog is open and comes back showing the outcome. */}
      <CancelPurchaseDialog purchase={cancelDialogOpen && purchase.data ? purchase.data : null}
        onOpenChange={(open) => !open && setCancelDialogOpen(false)} />
    </>
  )
}

function PurchaseMeta({ purchase }: { purchase: Purchase }) {
  const { t, i18n } = useTranslation()
  return (
    <>
      {purchase.supplier?.name} · {formatDateTime(purchase.purchaseDate, i18n.language)}
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
  const date = formatDateTime(purchase.purchaseDate, i18n.language, 'long')
  return (
    <PrintDocument kind={t('print.purchase.kind')} folio={purchase.id} date={date}>
      <PrintFields columns={2} fields={[
        [t('print.purchase.supplier'), purchase.supplier?.name],
        [t('print.purchase.recordedBy'), purchase.recordedBy?.name],
        ...(purchase.status === 'CANCELLED' ? [[
          t('purchases.status.CANCELLED'),
          t('purchases.detail.reason', { reason: purchase.cancellation?.reason }),
        ] as [string, string]] : []),
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
