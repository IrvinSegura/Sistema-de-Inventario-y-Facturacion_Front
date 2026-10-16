import { Languages, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { currentLanguage, type Language, languages } from '@/i18n'
import { cn } from '@/lib/utils'

import { type Theme, themes } from './themes'

// Menu rows that switch language and theme in place: the menu stays open so the change is visible.
// Both choices are remembered in this browser.
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const language = currentLanguage()
  const next: Language = language === 'es' ? 'en' : 'es'

  return (
    <DropdownMenuItem closeOnClick={false} onClick={() => void i18n.changeLanguage(next)}
      aria-label={t('preferences.switchLanguage', { language: t(`preferences.languages.${next}`) })}>
      <Languages />
      {t('preferences.language')}
      <Segmented value={language} options={languages.map((option) => ({ value: option, label: option.toUpperCase() }))} />
    </DropdownMenuItem>
  )
}

export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const theme: Theme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const icons = { light: Sun, dark: Moon }

  return (
    <DropdownMenuItem closeOnClick={false} onClick={() => setTheme(next)}
      aria-label={t('preferences.switchTheme', { theme: t(`preferences.themes.${next}`) })}>
      {theme === 'dark' ? <Moon /> : <Sun />}
      {t('preferences.theme')}
      <Segmented value={theme} options={themes.map((option) => {
        const Icon = icons[option]
        return { value: option, label: <Icon className="size-3.5" />, title: t(`preferences.themes.${option}`) }
      })} />
    </DropdownMenuItem>
  )
}

// Two-state pill showing both options; the whole row is the control, so this is only visual.
function Segmented<T extends string>({ value, options }: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
}) {
  return (
    <span className="ml-auto flex rounded-full bg-muted p-0.5" aria-hidden>
      {options.map((option) => (
        <span key={option.value} title={option.title}
          className={cn(
            'flex h-5 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors',
            option.value === value && 'bg-background text-foreground shadow-sm',
          )}>
          {option.label}
        </span>
      ))}
    </span>
  )
}
