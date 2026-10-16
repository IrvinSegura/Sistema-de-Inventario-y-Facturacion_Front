import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { currentLanguage, languages } from '@/i18n'
import { cn } from '@/lib/utils'

// Compact language (EN/ES) and light/dark switches for the sign-in screens. Same storage as
// PreferencesMenu, so the choice carries over to the app until changed again; Oxford counts as dark
// here, and System shows whichever the OS resolved to.
export function PreferenceToggles() {
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const language = currentLanguage()
  const dark = resolvedTheme !== undefined && resolvedTheme !== 'light'

  return (
    <div className="flex items-center gap-2">
      <Segmented label={t('preferences.language')}>
        {languages.map((option) => (
          <SegmentButton key={option} active={language === option} label={t(`preferences.languages.${option}`)}
            onClick={() => void i18n.changeLanguage(option)}>
            {option.toUpperCase()}
          </SegmentButton>
        ))}
      </Segmented>
      <Segmented label={t('preferences.theme')}>
        <SegmentButton active={!dark} label={t('preferences.modes.light')} onClick={() => setTheme('light')}>
          <Sun />{t('preferences.modes.light')}
        </SegmentButton>
        <SegmentButton active={dark} label={t('preferences.modes.dark')} onClick={() => setTheme('dark')}>
          <Moon />{t('preferences.modes.dark')}
        </SegmentButton>
      </Segmented>
    </div>
  )
}

function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-muted p-0.5">
      {children}
    </div>
  )
}

function SegmentButton({ active, label, onClick, children }: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" aria-pressed={active} aria-label={label} onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors outline-none',
        'focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-3.5',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}>
      {children}
    </button>
  )
}
