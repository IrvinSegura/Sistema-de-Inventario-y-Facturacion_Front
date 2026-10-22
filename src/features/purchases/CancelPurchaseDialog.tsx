import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Textarea } from '@/components/Textarea'
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
import { showSuccess } from '@/lib/success-popup'
import { REASON_MAX_LENGTH } from '@/lib/text-rules'

import { soldOutLine } from './cancel-purchase'
import { type Purchase, useCancelPurchase } from './queries'

/** Asks for the reason and cancels: every unit the purchase brought leaves stock. */
export function CancelPurchaseDialog({ purchase, onOpenChange }: {
  purchase: Purchase | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const cancelPurchase = useCancelPurchase()
  const schema = useMemo(() => z.object({
    reason: z.string().trim()
      .min(1, t('purchases.cancel.reasonRequired'))
      .max(REASON_MAX_LENGTH, t('validation.maxChars', { count: REASON_MAX_LENGTH })),
  }), [t])
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })
  const units = purchase?.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0

  // Units already sold block the cancellation: name the product instead of the API's id.
  function errorText(error: Error, current: Purchase) {
    const line = soldOutLine(error, current)
    return line ? t('purchases.cancel.alreadySold', { name: line.name }) : errorMessage(error)
  }

  // The form and mutation outlive each purchase, so clear the reason and the last error for the next one.
  function finish() {
    reset()
    cancelPurchase.reset()
    onOpenChange(false)
  }

  // Not while the request runs: the cancellation would still happen, without its confirmation.
  function close() {
    if (!cancelPurchase.isPending) {
      finish()
    }
  }

  const onSubmit = handleSubmit(({ reason }) =>
    cancelPurchase.mutate({ id: purchase!.id!, reason }, {
      onSuccess: () => {
        showSuccess(t('purchases.cancel.done', { id: purchase!.id }))
        finish()
      },
    }))

  return (
    <Dialog open={purchase !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        {purchase && (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>{t('purchases.cancel.title', { id: purchase.id })}</DialogTitle>
              <DialogDescription>{t('purchases.cancel.description', { count: units })}</DialogDescription>
            </DialogHeader>
            {cancelPurchase.isError && <ErrorAlert message={errorText(cancelPurchase.error, purchase)} />}
            <div className="grid gap-2">
              <Label htmlFor="cancel-purchase-reason">{t('purchases.cancel.reason')}</Label>
              <Textarea id="cancel-purchase-reason" rows={3} maxLength={REASON_MAX_LENGTH} autoFocus
                aria-invalid={!!errors.reason} {...register('reason')} />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={cancelPurchase.isPending} />}>{t('purchases.cancel.keep')}</DialogClose>
              <Button type="submit" variant="destructive" disabled={cancelPurchase.isPending}>
                {cancelPurchase.isPending ? t('purchases.cancel.cancelling') : t('purchases.cancel.confirm')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
