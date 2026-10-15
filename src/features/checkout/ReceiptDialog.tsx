import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMoney } from '@/lib/money'

import type { Sale } from './queries'

// Shows the sale as the server recorded it (prices and VAT snapshots, server-side totals).
export function ReceiptDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {sale && (
          <>
            <DialogHeader>
              <DialogTitle>Sale #{sale.saleNumber}</DialogTitle>
              <DialogDescription>
                {new Date(sale.saleDate!).toLocaleString('es-MX')} · {sale.customer?.name} · {sale.paymentMethod}
              </DialogDescription>
            </DialogHeader>
            <ul className="grid gap-1 text-sm">
              {sale.items?.map((item) => (
                <li key={item.productId} className="flex justify-between gap-4">
                  <span>{item.quantity} × {item.name}</span>
                  <span className="tabular-nums">{formatMoney(item.subtotal!)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-y-1 border-t pt-3 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right tabular-nums">{formatMoney(sale.subtotal!)}</dd>
              <dt className="text-muted-foreground">VAT</dt>
              <dd className="text-right tabular-nums">{formatMoney(sale.tax!)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold tabular-nums">{formatMoney(sale.total!)}</dd>
            </dl>
            <DialogFooter>
              <Button onClick={onClose} autoFocus>New sale</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
