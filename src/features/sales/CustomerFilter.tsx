import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Highlight } from '@/components/Highlight'
import { SearchPicker } from '@/components/SearchPicker'
import { Button } from '@/components/ui/button'
import { useCustomerSearch } from '@/features/checkout/queries'
import type { Customer } from '@/features/customers/queries'

function useResults(search: string) {
  const query = useCustomerSearch(search)
  return {
    items: query.data?.content ?? [],
    total: query.data?.page?.totalElements ?? 0,
    isFetching: query.isFetching,
    isError: query.isError,
  }
}

export interface CustomerRef {
  id: number
  name: string
}

// One customer to filter sales by, the walk-in customer included; cleared with the X.
export function CustomerFilter({ id, value, onChange }: {
  id: string
  value: CustomerRef | null
  onChange: (customer: CustomerRef | null) => void
}) {
  const { t } = useTranslation()
  if (value) {
    return (
      <div className="flex h-9 w-56 items-center gap-1 rounded-lg border pr-1 pl-2.5">
        <span className="min-w-0 flex-1 truncate text-sm">{value.name}</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={t('sales.filters.clearCustomer', { name: value.name })}
          onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    )
  }
  return (
    <SearchPicker<Customer> id={id} className="w-56" placeholder={t('sales.filters.customerPlaceholder')}
      useResults={useResults} getKey={(customer) => customer.id!}
      onPick={(customer) => onChange({ id: customer.id!, name: customer.name! })}
      renderOption={(customer, query) => (
        <span className="grid min-w-0">
          <span className="truncate font-medium"><Highlight text={customer.name} query={query} /></span>
          {customer.taxId && (
            <span className="truncate font-mono text-xs text-muted-foreground"><Highlight text={customer.taxId} query={query} /></span>
          )}
        </span>
      )} />
  )
}
