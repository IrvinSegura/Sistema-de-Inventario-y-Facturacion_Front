import { LayoutDashboard, type LucideIcon, ShoppingCart, Users, Wallet } from 'lucide-react'

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
  { to: '/sellers', label: 'app.nav.sellers', icon: Users, roles: ['ADMIN'] },
]
