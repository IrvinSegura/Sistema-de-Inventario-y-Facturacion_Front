import { Settings2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { currentLanguage, languages } from '@/i18n'

import { themes } from './themes'

// Language and theme; both are remembered in this browser.
export function PreferencesMenu() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('preferences.title')} />}>
        <Settings2 />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('preferences.language')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={currentLanguage()}
            onValueChange={(language: string) => void i18n.changeLanguage(language)}>
            {languages.map((language) => (
              <DropdownMenuRadioItem key={language} value={language}>
                {t(`preferences.languages.${language}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('preferences.theme')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={(value: string) => setTheme(value)}>
            {themes.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {t(`preferences.themes.${option}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
