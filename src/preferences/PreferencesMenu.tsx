import { Settings2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { LanguageToggle, ThemeToggle } from './PreferenceToggles'

// Language and theme before signing in; once signed in they live in the account menu.
export function PreferencesMenu() {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t('preferences.title')} />}>
        <Settings2 />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <LanguageToggle />
        <ThemeToggle />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
