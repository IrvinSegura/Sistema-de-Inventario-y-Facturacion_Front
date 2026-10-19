import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Highlight } from '@/components/Highlight'
import { SearchPicker } from '@/components/SearchPicker'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import type { SupplierRef } from './purchase-draft'
import { type Supplier, useSupplierSearch } from './queries'
import { SupplierDialog } from './SupplierDialog'

function useResults(search: string) {
  const query = useSupplierSearch(search)
  return {
    items: query.data?.content ?? [],
    total: query.data?.page?.totalElements ?? 0,
    isFetching: query.isFetching,
    isError: query.isError,
  }
}

function toRef(supplier: Supplier): SupplierRef {
  return { id: supplier.id!, name: supplier.name!, taxId: supplier.taxId }
}

// Active suppliers by name or tax ID; a missing one can be created without leaving the purchase.
export function SupplierPicker({ id, value, onChange, disabled, invalid }: {
  id: string
  value: SupplierRef | null
  onChange: (supplier: SupplierRef | null) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={value ? undefined : id}>{t('purchases.form.supplier')}</Label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setCreating(true)}>
          <Plus />
          {t('purchases.form.newSupplier')}
        </Button>
      </div>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border p-2 pl-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.name}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">{value.taxId ?? t('purchases.form.noTaxId')}</div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
            aria-label={t('purchases.form.changeSupplier', { name: value.name })} onClick={() => onChange(null)}>
            <X />
          </Button>
        </div>
      ) : (
        <div className={invalid ? 'rounded-lg ring-3 ring-destructive/20 [&_input]:border-destructive' : undefined}>
          <SearchPicker<Supplier> id={id} placeholder={t('purchases.form.supplierPlaceholder')} useResults={useResults}
            getKey={(supplier) => supplier.id!} onPick={(supplier) => onChange(toRef(supplier))} disabled={disabled}
            emptyText={t('purchases.form.noSupplierMatches')}
            renderOption={(supplier, query) => (
              <span className="grid min-w-0">
                <span className="truncate font-medium"><Highlight text={supplier.name} query={query} /></span>
                {supplier.taxId && (
                  <span className="truncate font-mono text-xs text-muted-foreground"><Highlight text={supplier.taxId} query={query} /></span>
                )}
              </span>
            )} />
        </div>
      )}
      <SupplierDialog open={creating ? 'new' : null} onOpenChange={setCreating}
        onCreated={(supplier) => onChange(toRef(supplier))} />
    </div>
  )
}
