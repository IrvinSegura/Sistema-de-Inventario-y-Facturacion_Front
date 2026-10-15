import { LogOut, ShoppingCart, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'

import { useAuth, useUser } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PreferencesMenu } from '@/preferences/PreferencesMenu'

const navItems = [
  { to: '/', label: 'app.nav.checkout', icon: ShoppingCart },
  { to: '/cash-drawer', label: 'app.nav.cashDrawer', icon: Wallet },
] as const

export function AppLayout() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useUser()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="font-semibold">{t('app.name')}</span>
          <nav className="flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) => cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground',
                  isActive && 'bg-muted text-foreground',
                )}>
                <Icon className="size-4" />
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{user.name}</span>
            <Badge variant="secondary">{t(`app.roles.${user.role}`)}</Badge>
            <PreferencesMenu />
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut />
              {t('app.signOut')}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  )
}
