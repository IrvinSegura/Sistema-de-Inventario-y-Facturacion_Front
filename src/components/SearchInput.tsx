import { LoaderCircle, Search, X } from 'lucide-react'
import { type ComponentProps, type Ref, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Search field of the app: magnifier on the left and, on the right, a spinner while results load
 * or our own clear button (the browser's blue one is hidden, it didn't match either theme).
 */
export function SearchInput({ value, onValueChange, loading = false, inputRef, className, wrapperClassName, ...props }:
  Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'ref'> & {
    value: string
    onValueChange: (value: string) => void
    loading?: boolean
    inputRef?: Ref<HTMLInputElement>
    wrapperClassName?: string
  }) {
  const { t } = useTranslation()
  const own = useRef<HTMLInputElement>(null)
  // The caller's ref gets the same input (for focusing it), while the clear button uses ours.
  useImperativeHandle(inputRef, () => own.current!, [])

  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={own} type="search" value={value} autoComplete="off" {...props}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn('h-9 pr-9 pl-8 [&::-webkit-search-cancel-button]:appearance-none', className)} />
      <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
        {loading ? (
          <LoaderCircle className="m-1 size-4 animate-spin text-muted-foreground" role="status" aria-label={t('search.searching')} />
        ) : value !== '' && !props.disabled && (
          <button type="button" aria-label={t('search.clear')} title={t('search.clear')}
            // Keeps the focus in the field, so a list under it stays open.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onValueChange('')
              own.current?.focus()
            }}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
            <X className="size-3.5" />
          </button>
        )}
      </span>
    </div>
  )
}
