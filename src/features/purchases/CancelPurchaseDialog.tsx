import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { showSuccess } from '@/lib/success-popup'

import { soldOutLine } from './cancel-purchase'
import { type Purchase, useCancelPurchase } from './queries'

/** Asks for the reason and cancels: every unit the purchase brought leaves stock. */
export function CancelPurchaseDialog({ purchase, onOpenChange }: {
  purchase: Purchase | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const cancelPurchase = useCancelPurchase()
  const units = purchase?.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0

  // Units already sold block the cancellation: name the product instead of the API's id.
  function errorText(error: Error) {
    const line = purchase && soldOutLine(error, purchase)
    return line ? t('purchases.cancel.alreadySold', { name: line.name }) : errorMessage(error)
  }

  return (
    <CancelReasonDialog id={purchase?.id ?? null} mutation={cancelPurchase} errorText={errorText}
      onOpenChange={onOpenChange}
      onCancelled={() => showSuccess(t('purchases.cancel.done', { id: purchase!.id }))}
      texts={{
        title: t('purchases.cancel.title', { id: purchase?.id }),
        description: t('purchases.cancel.description', { count: units }),
        reason: t('purchases.cancel.reason'),
        reasonRequired: t('purchases.cancel.reasonRequired'),
        keep: t('purchases.cancel.keep'),
        confirm: t('purchases.cancel.confirm'),
        cancelling: t('purchases.cancel.cancelling'),
      }} />
  )
}
