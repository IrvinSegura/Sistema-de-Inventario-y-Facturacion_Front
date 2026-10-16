import { LayoutDashboard, type LucideIcon, Package, ShoppingCart, Tags, Users, Wallet } from 'lucide-react'

import type { Role } from '@/auth/auth-context'
import type { MessageKey } from '@/i18n'

export interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
  // Shown only to these roles; everyone when omitted.
  roles?: Role[]
}

export const navItems: NavItem[] = [
  { to: '/', label: 'app.nav.dashboard', icon: LayoutDashboard },
  { to: '/checkout', label: 'app.nav.checkout', icon: ShoppingCart },
  { to: '/cash-drawer', label: 'app.nav.cashDrawer', icon: Wallet },
  // Everyone can look up prices and stock; only admins see the create and edit buttons.
  { to: '/products', label: 'app.nav.products', icon: Package },
  { to: '/categories', label: 'app.nav.categories', icon: Tags },
  { to: '/sellers', label: 'app.nav.sellers', icon: Users, roles: ['ADMIN'] },
]
