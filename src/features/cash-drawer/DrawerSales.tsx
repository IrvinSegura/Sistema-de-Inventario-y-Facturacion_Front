import { Ban, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReceiptDialog } from '@/features/checkout/ReceiptDialog'
import { formatTime } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

import { type SaleSummary, useCancelSale, useDrawerSales, useSale } from './queries'


/**
 * The tickets recorded in a drawer (a seller only gets their own): tap one to see or print it again;
 * managers can cancel. No sum is shown, so a seller can't read the expected cash before the blind count.
 */
export function DrawerSales({ drawerId, canCancel, showSeller = false }: {
  drawerId: number
  canCancel: boolean
  showSeller?: boolean
}) {
  const { t, i18n } = useTranslation()
  const sales = useDrawerSales(drawerId)
  const [viewing, setViewing] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState<SaleSummary | null>(null)
  const receipt = useSale(viewing)

  if (sales.isPending) {
    return <p className="text-sm text-muted-foreground">{t('app.loading')}…</p>
  }
  if (sales.isError) {
    return <ErrorAlert message={errorMessage(sales.error)} />
  }
  if (sales.data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('drawer.noTickets')}</p>
  }
  return (
    <>
      <ul className="grid divide-y rounded-lg border text-sm">
        {sales.data.map((sale) => {
          const cancelled = sale.status === 'CANCELLED'
          return (
            <li key={sale.id} className="flex items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => setViewing(sale.id!)}
                className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-3 text-left hover:underline"
                aria-label={t('drawer.viewTicket', { number: sale.saleNumber })}>
                <span className="font-medium tabular-nums">#{sale.saleNumber}</span>
                <span className="truncate text-muted-foreground">
                  {formatTime(sale.saleDate, i18n.language)} · {t(`checkout.paymentMethods.${sale.paymentMethod!}`)}
                  {showSeller && <> · {sale.seller?.name}</>}
                </span>
                <span className={cn('tabular-nums', cancelled && 'text-muted-foreground line-through')}>
                  {formatMoney(sale.total!)}
                </span>
              </button>
              {cancelled ? (
                <Badge variant="outline" className="text-destructive">{t('drawer.cancelledBadge')}</Badge>
              ) : canCancel && (
                <Button variant="ghost" size="icon" aria-label={t('drawer.cancelTicket', { number: sale.saleNumber })}
                  onClick={() => setCancelling(sale)}>
                  <Ban />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {viewing !== null && receipt.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Receipt className="size-4" />{t('app.loading')}…</p>
      )}
      {viewing !== null && receipt.isError && <ErrorAlert message={errorMessage(receipt.error)} />}
      <ReceiptDialog sale={viewing !== null ? receipt.data ?? null : null} closeLabel={t('app.close')}
        onClose={() => setViewing(null)} />
      <CancelSaleDialog sale={cancelling} onOpenChange={(open) => !open && setCancelling(null)} />
    </>
  )
}

/** Asks for the reason and cancels: the sale's stock goes back and its total is refunded. */
export function CancelSaleDialog({ sale, onOpenChange, onCancelled }: {
  sale: Pick<SaleSummary, 'id' | 'saleNumber' | 'total'> | null
  onOpenChange: (open: boolean) => void
  onCancelled?: () => void
}) {
  const { t } = useTranslation()
  const cancelSale = useCancelSale()
  return (
    <CancelReasonDialog id={sale?.id ?? null} mutation={cancelSale} onOpenChange={onOpenChange}
      onCancelled={() => {
        showSuccess(t('drawer.ticketCancelled', { number: sale!.saleNumber }))
        onCancelled?.()
      }}
      texts={{
        title: t('drawer.cancelTitle', { number: sale?.saleNumber }),
        description: t('drawer.cancelDescription', { amount: formatMoney(sale?.total ?? 0) }),
        reason: t('drawer.reasonInput'),
        reasonRequired: t('drawer.reasonRequired'),
        keep: t('drawer.keepTicket'),
        confirm: t('drawer.confirmCancel'),
        cancelling: t('drawer.cancellingTicket'),
      }} />
  )
}
