import { UserPlus, X } from 'lucide-react'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/components/SearchInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CustomerDialog } from '@/features/customers/CustomerDialog'
import type { Customer } from '@/features/customers/queries'

import { CUSTOMER_MATCHES, useCustomerSearch } from './queries'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300

// No customer means the sale goes to the walk-in customer (público en general).
export function CustomerPicker({ value, onChange, disabled }: {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const matches = useCustomerSearch(search)

  useEffect(() => {
    const next = searchText.trim()
    if (next === search) {
      return
    }
    const timer = window.setTimeout(() => setSearch(next), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [searchText, search])

  const content = matches.data?.content ?? []
  const options = content.filter((customer) => !customer.walkIn).slice(0, CUSTOMER_MATCHES)
  const total = (matches.data?.page?.totalElements ?? 0) - (content.some((customer) => customer.walkIn) ? 1 : 0)
  const showResults = searchText.trim() !== '' && search !== ''

  function pick(customer: Customer | null) {
    onChange(customer)
    setSearchText('')
    setSearch('')
  }

  // Enter takes the first match, Escape clears the search.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (showResults && options[0]) {
        pick(options[0])
      }
    } else if (event.key === 'Escape' && searchText) {
      event.preventDefault()
      setSearchText('')
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={value ? undefined : inputId}>{t('checkout.customer.label')}</Label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setCreating(true)}>
          <UserPlus />
          {t('checkout.customer.new')}
        </Button>
      </div>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border p-2 pl-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{value.name}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">
              {value.taxId ?? t('checkout.customer.noTaxId')}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
            aria-label={t('checkout.customer.clear', { name: value.name })} onClick={() => pick(null)}>
            <X />
          </Button>
        </div>
      ) : (
        <>
          <SearchInput id={inputId} value={searchText} onValueChange={setSearchText} onKeyDown={onKeyDown}
            placeholder={t('checkout.customer.searchPlaceholder')} disabled={disabled}
            loading={searchText.trim() !== '' && (searchText.trim() !== search || matches.isFetching)} />
          {showResults ? (
            <div className="grid gap-1" aria-live="polite">
              {matches.isError ? (
                <p className="text-sm text-destructive">{t('checkout.customer.searchFailed')}</p>
              ) : matches.isPending ? (
                <p className="text-sm text-muted-foreground">{t('checkout.customer.searching')}</p>
              ) : options.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('checkout.customer.noMatches')}</p>
              ) : (
                <>
                  <ul className="grid gap-1" aria-label={t('checkout.customer.matches')}>
                    {options.map((customer) => (
                      <li key={customer.id}>
                        <button type="button" disabled={disabled} onClick={() => pick(customer)}
                          className="w-full rounded-md border px-3 py-1.5 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                          <span className="block truncate text-sm font-medium">{customer.name}</span>
                          {customer.taxId && (
                            <span className="block truncate font-mono text-xs text-muted-foreground">{customer.taxId}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {total > options.length && (
                    <p className="text-xs text-muted-foreground">{t('checkout.customer.moreMatches')}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('checkout.customer.walkInHint')}</p>
          )}
        </>
      )}
      <CustomerDialog open={creating ? 'new' : null} onOpenChange={setCreating} onCreated={pick} />
    </div>
  )
}
