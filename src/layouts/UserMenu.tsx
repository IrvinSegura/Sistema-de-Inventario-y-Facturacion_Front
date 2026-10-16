import { ChevronDown, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth, useUser } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials } from '@/lib/initials'
import { LanguageToggle, ThemeToggle } from '@/preferences/PreferenceToggles'

export function UserMenu() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useUser()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2 px-1.5 sm:pr-2.5" />}
        aria-label={t('app.accountMenu')}>
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(user.name)}
        </span>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-40 truncate text-sm font-medium">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">{t(`app.roles.${user.role}`)}</span>
        </span>
        <ChevronDown className="hidden text-muted-foreground sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-start justify-between gap-2 px-2 py-1.5">
            <span className="grid min-w-0">
              <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
              <span className="truncate font-normal">{user.email}</span>
            </span>
            <Badge variant="secondary">{t(`app.roles.${user.role}`)}</Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <LanguageToggle />
          <ThemeToggle />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut />
          {t('app.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
