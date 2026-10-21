import { type ClipboardEvent, type KeyboardEvent, useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * One box per digit: typing moves to the next box, Backspace clears and goes back, and pasting a
 * whole code (or the phone's SMS autofill) fills every box. The value never has gaps.
 */
export function OtpInput({ value, onChange, length = 6, invalid, autoFocus, label }: {
  value: string
  onChange: (value: string) => void
  length?: number
  invalid?: boolean
  autoFocus?: boolean
  /** Accessible name of the group; each box is announced as this label plus its position. */
  label: string
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  // Keys can arrive faster than React re-renders; every change starts from the newest value.
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  }, [value])
  const digits = Array.from({ length }, (_, index) => value[index] ?? '')

  function update(next: string, focusIndex: number) {
    latest.current = next
    onChange(next)
    inputs.current[Math.max(0, Math.min(focusIndex, length - 1))]?.focus()
  }

  // Writes the typed or pasted digits from this box on.
  function write(index: number, typed: string) {
    const clean = typed.replace(/\D/g, '')
    if (!clean) {
      return
    }
    const current = latest.current
    const from = Math.min(index, current.length)
    const next = (current.slice(0, from) + clean + current.slice(from + clean.length)).slice(0, length)
    update(next, from + clean.length)
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    const current = latest.current
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (index < current.length) {
        update(current.slice(0, index) + current.slice(index + 1), index)
      } else if (index > 0) {
        update(current.slice(0, index - 1), index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      inputs.current[Math.max(0, index - 1)]?.focus()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      inputs.current[Math.min(index + 1, current.length, length - 1)]?.focus()
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    write(index, event.clipboardData.getData('text'))
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2">
      {digits.map((digit, index) => (
        <input key={index} ref={(element) => { inputs.current[index] = element }}
          // maxLength is the whole code, not 1, so the SMS autofill in the first box arrives complete.
          value={digit} inputMode="numeric" pattern="\d*" maxLength={length}
          autoComplete={index === 0 ? 'one-time-code' : 'off'} autoFocus={autoFocus && index === 0}
          aria-label={`${label} ${index + 1}`} aria-invalid={invalid || undefined}
          onChange={(event) => {
            // The box's text is selected on focus, so typing replaces it; if not, drop the old digit.
            const typed = event.target.value
            write(index, digit && typed.length > 1 ? typed.replace(digit, '') : typed)
          }}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={(event) => onPaste(index, event)}
          onFocus={(event) => {
            // No gaps: a box past the first empty one sends focus back to it.
            if (index > latest.current.length) {
              inputs.current[latest.current.length]?.focus()
            } else {
              event.target.select()
            }
          }}
          className={cn(
            'h-12 w-full min-w-0 rounded-lg border border-input bg-transparent text-center text-lg font-semibold tabular-nums transition-colors outline-none dark:bg-input/30',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
          )} />
      ))}
    </div>
  )
}
