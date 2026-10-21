import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Textarea } from '@/components/Textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ReceiptDialog } from '@/features/checkout/ReceiptDialog'
import { formatMoney } from '@/lib/money'
import { showSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

import { formatTime } from './format'
import { type SaleSummary, useCancelSale, useDrawerSales, useSale } from './queries'

const REASON_MAX_LENGTH = 255

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
                  {formatTime(sale.saleDate!, i18n.language)} · {t(`checkout.paymentMethods.${sale.paymentMethod!}`)}
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
  const schema = useMemo(() => z.object({
    reason: z.string().trim()
      .min(1, t('drawer.reasonRequired'))
      .max(REASON_MAX_LENGTH, t('validation.maxChars', { count: REASON_MAX_LENGTH })),
  }), [t])
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })

  // The form and mutation outlive each ticket, so clear the reason and the last error for the next one.
  function close() {
    reset()
    cancelSale.reset()
    onOpenChange(false)
  }

  const onSubmit = handleSubmit(({ reason }) =>
    cancelSale.mutate({ id: sale!.id!, reason }, {
      onSuccess: () => {
        showSuccess(t('drawer.ticketCancelled', { number: sale!.saleNumber }))
        close()
        onCancelled?.()
      },
    }))

  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        {sale && (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t('drawer.cancelTitle', { number: sale.saleNumber })}</DialogTitle>
              <DialogDescription>
                {t('drawer.cancelDescription', { amount: formatMoney(sale.total!) })}
              </DialogDescription>
            </DialogHeader>
            {cancelSale.isError && <ErrorAlert message={errorMessage(cancelSale.error)} />}
            <div className="grid gap-2">
              <Label htmlFor="cancel-reason">{t('drawer.reasonInput')}</Label>
              <Textarea id="cancel-reason" rows={3} maxLength={REASON_MAX_LENGTH} autoFocus
                aria-invalid={!!errors.reason} {...register('reason')} />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{t('drawer.keepTicket')}</DialogClose>
              <Button type="submit" variant="destructive" disabled={cancelSale.isPending}>
                {cancelSale.isPending ? t('drawer.cancellingTicket') : t('drawer.confirmCancel')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
