import { Store, X } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router'

import { useUser } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { navItems } from './nav-items'

/**
 * On desktop always visible, icons only while `collapsed`. On phones a drawer shown while `drawerOpen`;
 * Escape, the backdrop and its close button call onDrawerClose.
 */
export function AppSidebar({ collapsed, drawerOpen, onDrawerClose }: {
  collapsed: boolean
  drawerOpen: boolean
  onDrawerClose: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!drawerOpen) {
      return
    }
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onDrawerClose()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [drawerOpen, onDrawerClose])

  return (
    <>
      {/* Desktop: always visible, full width or icons only. */}
      <aside className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-60',
      )}>
        <div className="flex h-16 shrink-0 items-center border-b px-3.5">
          <Brand compact={collapsed} />
        </div>
        <SidebarNav compact={collapsed} />
      </aside>

      {/* Phones: a drawer over the page. It stays mounted to slide in and out; while closed it lets
          clicks through and is inert, keeping its links out of the tab order. */}
      <div className={cn('fixed inset-0 z-50 md:hidden', !drawerOpen && 'pointer-events-none')}>
        <div onClick={onDrawerClose} aria-hidden
          className={cn('absolute inset-0 bg-black/40 transition-opacity', drawerOpen ? 'opacity-100' : 'opacity-0')} />
        <aside inert={!drawerOpen}
          className={cn(
            'absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}>
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-3.5">
            <Brand />
            <Button variant="ghost" size="icon" onClick={onDrawerClose} aria-label={t('app.closeMenu')}>
              <X />
            </Button>
          </div>
          <SidebarNav />
        </aside>
      </div>
    </>
  )
}

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useTranslation()

  return (
    <Link to="/" aria-label={compact ? t('app.name') : undefined}
      className={cn('flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Store className="size-5" />
      </span>
      {!compact && <span className="truncate text-base font-semibold tracking-tight">{t('app.name')}</span>}
    </Link>
  )
}

function SidebarNav({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { role } = useUser()
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <nav aria-label={t('app.mainNavigation')} className="grid gap-1 overflow-y-auto p-3">
      {visibleItems.map(({ to, label, icon: Icon, badge: ItemBadge }) => (
        // Exact match only for the dashboard ("/"); other sections stay highlighted on their tabs.
        <NavLink key={to} to={to} end={to === '/'} title={compact ? t(label) : undefined}
          className={({ isActive }) => cn(
            'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
            compact && 'justify-center px-0',
            isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
          )}>
          <Icon className="size-4 shrink-0" />
          {compact ? <span className="sr-only">{t(label)}</span> : t(label)}
          {ItemBadge && <ItemBadge compact={compact} />}
        </NavLink>
      ))}
    </nav>
  )
}
