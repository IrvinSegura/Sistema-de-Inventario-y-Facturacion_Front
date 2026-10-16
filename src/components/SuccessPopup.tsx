import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { currentSuccess, dismissSuccess, type SuccessMessage, subscribeSuccess } from '@/lib/success-popup'
import { cn } from '@/lib/utils'

// How long a popup stays before fading out, and how long the fade takes (matches the CSS).
const VISIBLE_MS = 2200
const EXIT_MS = 200

// Mounted once (main.tsx): a card that pops in at the center with a check being drawn, then fades
// out on its own. Clicking it or pressing Escape closes it sooner; it never blocks the page.
export function SuccessPopup() {
  const message = useSyncExternalStore(subscribeSuccess, currentSuccess)
  return message ? <PopupCard key={message.id} message={message} /> : null
}

function PopupCard({ message }: { message: SuccessMessage }) {
  const { t } = useTranslation()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const leave = window.setTimeout(() => setLeaving(true), VISIBLE_MS)
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setLeaving(true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.clearTimeout(leave)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    if (!leaving) {
      return
    }
    const remove = window.setTimeout(() => dismissSuccess(message.id), EXIT_MS)
    return () => window.clearTimeout(remove)
  }, [leaving, message.id])

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4" role="status" aria-live="polite">
      <button type="button" onClick={() => setLeaving(true)} aria-label={t('app.close')}
        className={cn(
          'pointer-events-auto grid w-full max-w-xs justify-items-center gap-3 rounded-2xl bg-popover px-6 py-7 text-center text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none',
          leaving ? 'animate-success-out' : 'animate-success-in',
        )}>
        <span className="relative flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-success-ring rounded-full bg-emerald-500/30" />
          <svg viewBox="0 0 52 52" className="relative size-16" aria-hidden>
            <circle cx="26" cy="26" r="24" className="animate-success-circle fill-none stroke-emerald-500" strokeWidth="3" />
            <path d="M15 27l7 7 15-15" className="animate-success-check fill-none stroke-emerald-500"
              strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-lg font-semibold tracking-tight">{message.title}</span>
        {message.description && <span className="text-sm text-muted-foreground">{message.description}</span>}
      </button>
    </div>
  )
}
