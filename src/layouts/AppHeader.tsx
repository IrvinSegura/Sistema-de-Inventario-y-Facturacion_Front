import { type LucideIcon, ShoppingCart, Store, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'

import { type Role, useUser } from '@/auth/auth-context'
import type { MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { PreferencesMenu } from '@/preferences/PreferencesMenu'

import { UserMenu } from './UserMenu'

interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
  // Shown only to these roles; everyone when omitted.
  roles?: Role[]
}

const navItems: NavItem[] = [
  { to: '/', label: 'app.nav.checkout', icon: ShoppingCart },
  { to: '/cash-drawer', label: 'app.nav.cashDrawer', icon: Wallet },
  { to: '/sellers', label: 'app.nav.sellers', icon: Users, roles: ['ADMIN'] },
]

export function AppHeader() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Store className="size-5" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">{t('app.name')}</span>
        </Link>
        <MainNav className="hidden h-full md:flex" />
        <div className="ml-auto flex items-center gap-1">
          <PreferencesMenu />
          <div className="mx-1 h-6 w-px bg-border" aria-hidden />
          <UserMenu />
        </div>
      </div>
      {/* Small screens: the sections move to their own scrollable row. */}
      <MainNav className="flex h-11 overflow-x-auto border-t px-2 md:hidden" />
    </header>
  )
}

function MainNav({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { role } = useUser()
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <nav aria-label={t('app.mainNavigation')} className={cn('items-stretch gap-1', className)}>
      {visibleItems.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end
          className={({ isActive }) => cn(
            'relative flex shrink-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none',
            'hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
            // Active section: underline flush with the header's bottom border.
            'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors',
            isActive && 'text-foreground after:bg-primary',
          )}>
          <Icon className="size-4" />
          {t(label)}
        </NavLink>
      ))}
    </nav>
  )
}
