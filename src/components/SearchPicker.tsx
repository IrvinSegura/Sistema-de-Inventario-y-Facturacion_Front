import { type CSSProperties, type KeyboardEvent, type ReactNode, type Ref, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/components/SearchInput'
import { cn } from '@/lib/utils'

// Waits for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 300
// Room the list needs below the input; with less, it opens above when there's more space there.
const LIST_ROOM = 320
const GAP = 4

// Where the floating list goes: under the input (or above it near the bottom of the window), as wide
// as the input. Fixed to the window, so no card or scroll container clips it.
function listPosition(anchor: DOMRect): CSSProperties {
  const below = window.innerHeight - anchor.bottom
  const above = below < LIST_ROOM && anchor.top > below
  return {
    position: 'fixed',
    left: anchor.left,
    width: anchor.width,
    ...(above ? { bottom: window.innerHeight - anchor.top + GAP } : { top: anchor.bottom + GAP }),
    maxHeight: Math.max((above ? anchor.top : below) - 2 * GAP, 120),
  }
}

export interface SearchResults<T> {
  items: T[]
  // Matches on the server; more than items means the search needs more letters.
  total: number
  isFetching: boolean
  isError: boolean
}

// Search box with a list of matches under it: arrows move, Enter or a click picks one, Escape clears.
// useResults is a query hook called with the debounced text ('' while nothing is typed).
// onEnter runs first on Enter with the raw text (e.g. an exact barcode); returning true handles it.
export function SearchPicker<T>({
  id, placeholder, useResults, getKey, renderOption, onPick, onEnter, disabled, autoFocus, ariaLabel, inputRef,
  className, emptyText,
}: {
  id?: string
  placeholder: string
  useResults: (search: string) => SearchResults<T>
  getKey: (item: T) => string | number
  // query: the search the list answers, to highlight what matches.
  renderOption: (item: T, query: string) => ReactNode
  onPick: (item: T) => void
  onEnter?: (text: string) => boolean | Promise<boolean>
  disabled?: boolean
  autoFocus?: boolean
  ariaLabel?: string
  inputRef?: Ref<HTMLInputElement>
  className?: string
  emptyText?: string
}) {
  const { t } = useTranslation()
  const listId = useId()
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const results = useResults(search)

  useEffect(() => {
    const next = text.trim()
    if (next === search) {
      return
    }
    const timer = window.setTimeout(() => {
      setSearch(next)
      setHighlighted(0)
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [text, search])

  const showList = open && text.trim() !== '' && search !== ''

  // Follows the input while the list is open: scrolling anywhere or resizing moves it.
  useLayoutEffect(() => {
    if (!showList) {
      return
    }
    const update = () => setPosition(listPosition(anchor.current!.getBoundingClientRect()))
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [showList])
  const items = results.items

  function pick(item: T) {
    onPick(item)
    setText('')
    setSearch('')
    setHighlighted(0)
  }

  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (items.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1
        setHighlighted((current) => (current + step + items.length) % items.length)
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const raw = text.trim()
      if (raw === '') {
        return
      }
      if (onEnter && await onEnter(raw)) {
        setText('')
        setSearch('')
        return
      }
      // Only what is on screen for the current text can be picked.
      if (showList && raw === search && items[highlighted]) {
        pick(items[highlighted])
      }
    } else if (event.key === 'Escape' && text) {
      event.preventDefault()
      setText('')
      setSearch('')
    }
  }

  return (
    <div ref={anchor} className={cn('relative', className)}>
      <SearchInput id={id} inputRef={inputRef} value={text} placeholder={placeholder}
        autoFocus={autoFocus} disabled={disabled} aria-label={ariaLabel}
        // Waiting for the pause in typing or for the server.
        loading={text.trim() !== '' && (text.trim() !== search || results.isFetching)}
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && items[highlighted] ? `${listId}-${getKey(items[highlighted])}` : undefined}
        onValueChange={(value) => {
          setText(value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => void onKeyDown(event)} />
      {showList && position && createPortal(
        <div style={position}
          className="z-50 flex flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          {results.isError ? (
            <p className="px-3 py-2 text-sm text-destructive">{t('picker.failed')}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {results.isFetching ? t('picker.searching') : emptyText ?? t('picker.noMatches')}
            </p>
          ) : (
            <>
              <ul id={listId} role="listbox" className="max-h-72 min-h-0 overflow-y-auto p-1">
                {items.map((item, index) => (
                  <li key={getKey(item)} id={`${listId}-${getKey(item)}`} role="option" aria-selected={index === highlighted}
                    // Keeps the focus in the input, so the blur doesn't close the list before the click.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => pick(item)}
                    className={cn('cursor-default rounded-md px-2.5 py-1.5 text-sm', index === highlighted && 'bg-accent text-accent-foreground')}>
                    {renderOption(item, search)}
                  </li>
                ))}
              </ul>
              {results.total > items.length && (
                <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">{t('picker.moreMatches')}</p>
              )}
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
