import { Archive, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
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
import { showSuccess } from '@/lib/success-popup'

import { type Product, useDeleteProduct, useUpdateProduct } from './queries'

// Same message as the API's ProductService.IN_USE_MESSAGE.
const IN_USE = 'Product has stock movements; deactivate it instead'

/**
 * Deleting only works for products never purchased, sold or adjusted; for the rest the API says so
 * and the dialog offers to deactivate it instead, which keeps its history.
 */
export function DeleteProductDialog({ product, onOpenChange }: { product: Product | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const deleteProduct = useDeleteProduct()
  const updateProduct = useUpdateProduct()
  // Keeps the last product on screen while the dialog animates out; each opening starts clean.
  const [shown, setShown] = useState(product)
  if (product && product !== shown) {
    setShown(product)
    deleteProduct.reset()
    updateProduct.reset()
  }
  const inUse = deleteProduct.error instanceof ApiError && deleteProduct.error.message === IN_USE
  const pending = deleteProduct.isPending || updateProduct.isPending
  const close = () => onOpenChange(false)

  const onDelete = () => deleteProduct.mutate(shown!.id!, {
    onSuccess: () => {
      showSuccess(t('products.delete.doneTitle'), shown!.name)
      close()
    },
  })

  // The same data with active = false; the version guards against someone else's edit in between.
  const onDeactivate = () => {
    const product = shown!
    updateProduct.mutate({
      id: product.id!,
      sku: product.sku!,
      barcode: product.barcode,
      name: product.name!,
      description: product.description,
      imageUrl: product.imageUrl,
      categoryId: product.category!.id!,
      salePrice: product.salePrice!,
      taxRate: product.taxRate!,
      minStock: product.minStock!,
      active: false,
      version: product.version!,
    }, {
      onSuccess: () => {
        showSuccess(t('products.delete.deactivatedTitle'), product.name)
        close()
      },
    })
  }

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-5" />
          </span>
          <span className="grid gap-1.5">
            <DialogTitle className="text-lg">{t('products.delete.title', { name: shown?.name })}</DialogTitle>
            <DialogDescription>{t('products.delete.description')}</DialogDescription>
          </span>
        </DialogHeader>

        {inUse ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {shown?.active ? t('products.delete.inUse') : t('products.delete.inUseInactive')}
          </p>
        ) : deleteProduct.isError && <ErrorAlert message={errorMessage(deleteProduct.error)} />}
        {updateProduct.isError && <ErrorAlert message={errorMessage(updateProduct.error)} />}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t('products.form.cancel')}</DialogClose>
          {inUse ? (
            shown?.active && (
              <Button type="button" onClick={onDeactivate} disabled={pending}>
                <Archive />
                {updateProduct.isPending ? t('products.form.saving') : t('products.delete.deactivate')}
              </Button>
            )
          ) : (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
              <Trash2 />
              {deleteProduct.isPending ? t('products.delete.deleting') : t('products.delete.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
