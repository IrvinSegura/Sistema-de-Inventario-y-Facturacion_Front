import { PackageOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Product } from '@/features/products/queries'
import { StockForm } from '@/features/products/StockForm'

/**
 * The same adjustment as the product's Stock tab, straight from the inventory lists; open while
 * product is set.
 */
export function AdjustStockDialog({ product, onOpenChange }: { product: Product | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  // Keeps the last product on screen while the dialog animates out; every opening gets its own
  // form and Idempotency-Key, even for the same product.
  const [shown, setShown] = useState(product)
  const [opening, setOpening] = useState(product ? 1 : 0)
  const [wasOpen, setWasOpen] = useState(!!product)
  if (!!product !== wasOpen) {
    setWasOpen(!!product)
    if (product) {
      setShown(product)
      setOpening(opening + 1)
    }
  }
  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4 pr-12">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PackageOpen className="size-5" />
          </span>
          <span className="grid min-w-0 gap-1">
            <DialogTitle className="text-lg">{t('inventory.adjust.title')}</DialogTitle>
            <DialogDescription className="truncate">{shown?.name}</DialogDescription>
          </span>
        </DialogHeader>
        {shown && <StockForm key={opening} product={shown} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
