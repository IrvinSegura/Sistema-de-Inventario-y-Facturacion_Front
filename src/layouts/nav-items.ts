import {
  ChartColumn,
  Contact,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'

import type { Role } from '@/auth/auth-context'
import type { MessageKey } from '@/i18n'

export interface NavItem {
  to: string
  label: MessageKey
  icon: LucideIcon
  /** Shown only to these roles; everyone when omitted. */
  roles?: Role[]
}

// Store management sections; the API allows them to admins and supervisors only.
const MANAGERS: Role[] = ['ADMIN', 'SUPERVISOR']

export const navItems: NavItem[] = [
  { to: '/', label: 'app.nav.dashboard', icon: LayoutDashboard },
  { to: '/supervision', label: 'app.nav.supervision', icon: ShieldCheck, roles: MANAGERS },
  // Only sellers charge: managers have no cash drawer.
  { to: '/checkout', label: 'app.nav.checkout', icon: ShoppingCart, roles: ['SELLER'] },
  { to: '/cash-drawer', label: 'app.nav.cashDrawer', icon: Wallet },
  { to: '/sales', label: 'app.nav.sales', icon: Receipt, roles: MANAGERS },
  // Everyone can look up prices and stock; only managers see the create and edit buttons.
  { to: '/products', label: 'app.nav.products', icon: Package },
  { to: '/categories', label: 'app.nav.categories', icon: Tags },
  { to: '/inventory', label: 'app.nav.inventory', icon: Warehouse, roles: MANAGERS },
  { to: '/purchases', label: 'app.nav.purchases', icon: Truck, roles: MANAGERS },
  { to: '/customers', label: 'app.nav.customers', icon: Contact, roles: MANAGERS },
  // Sellers get their own sales report; managers every report.
  { to: '/reports', label: 'app.nav.reports', icon: ChartColumn },
  // Manages the accounts of every role: sellers, supervisors and admins.
  { to: '/users', label: 'app.nav.users', icon: Users, roles: ['ADMIN'] },
]
