import type { Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api, unwrap } from '@/api/client'
import { ApiError, errorMessage } from '@/api/errors'
import { Highlight } from '@/components/Highlight'
import { SearchPicker } from '@/components/SearchPicker'
import { cn } from '@/lib/utils'

import { ProductThumbnail } from './ProductThumbnail'
import { type Product, useProductSearch } from './queries'

// Same rule as the barcode field in ProductDialogs.
const BARCODE = /^\d{8,14}$/

/** Search by name or SKU, or type/scan a whole barcode and press Enter to take that product at once. */
export function ProductPicker({ id, onPick, active = true, placeholder, disabled, autoFocus, inputRef, className }: {
  id?: string
  onPick: (product: Product) => void
  /** Which products the list shows; a scanned barcode is checked against it too. */
  active?: boolean
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  inputRef?: Ref<HTMLInputElement>
  className?: string
}) {
  const { t } = useTranslation()

  // A hook SearchPicker calls on every render; declared here so it can read `active`.
  function useResults(search: string) {
    const query = useProductSearch(search, active)
    return {
      items: query.data?.content ?? [],
      total: query.data?.page?.totalElements ?? 0,
      isFetching: query.isFetching,
      isError: query.isError,
    }
  }

  // An exact barcode skips the list: what a scanner types ends with Enter.
  async function onEnter(text: string) {
    if (!BARCODE.test(text)) {
      return false
    }
    try {
      const product = await unwrap(api.GET('/api/v1/products/barcode/{barcode}', { params: { path: { barcode: text } } }))
      if (active && !product.active) {
        toast.error(t('picker.productInactive', { name: product.name }))
      } else {
        onPick(product)
      }
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 404
        ? t('picker.barcodeNotFound', { code: text })
        : errorMessage(error))
    }
    return true
  }

  return (
    <SearchPicker<Product> id={id} placeholder={placeholder ?? t('picker.productPlaceholder')} ariaLabel={id ? undefined : t('picker.productLabel')}
      useResults={useResults} getKey={(product) => product.id!} onPick={onPick} onEnter={onEnter}
      disabled={disabled} autoFocus={autoFocus} inputRef={inputRef} className={className}
      renderOption={(product, query) => (
        <span className="flex items-center gap-3">
          <ProductThumbnail url={product.imageUrl} className="size-9 rounded-md" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-medium"><Highlight text={product.name} query={query} /></span>
            <span className="truncate font-mono text-xs text-muted-foreground">
              <Highlight text={product.sku} query={query} />
              {product.barcode && <> · <Highlight text={product.barcode} query={query} /></>}
            </span>
          </span>
          <span className={cn('shrink-0 text-xs tabular-nums', product.lowStock ? 'text-destructive' : 'text-muted-foreground')}>
            {t('picker.inStock', { count: product.stock ?? 0 })}
          </span>
        </span>
      )} />
  )
}
