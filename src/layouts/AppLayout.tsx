import { PanelLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { LiveAlertsProvider } from '@/features/supervision/LiveAlertsProvider'

import { AppSidebar, Brand } from './AppSidebar'
import { UserMenu } from './UserMenu'

const collapsedKey = 'inventory.sidebarCollapsed'
const desktopQuery = '(min-width: 768px)'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(collapsedKey) === 'true'
  } catch {
    return false
  }
}

export function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // Desktop: the sidebar shrinks to icons and stays that way across visits. Phones: it's a drawer.
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPath, setDrawerPath] = useState(pathname)

  // Picking a section closes the drawer.
  if (drawerPath !== pathname) {
    setDrawerPath(pathname)
    setDrawerOpen(false)
  }

  useEffect(() => {
    try {
      localStorage.setItem(collapsedKey, String(collapsed))
    } catch {
      // Storage blocked: the choice only lasts for this visit.
    }
  }, [collapsed])

  function toggleSidebar() {
    if (window.matchMedia(desktopQuery).matches) {
      setCollapsed((value) => !value)
    } else {
      setDrawerOpen(true)
    }
  }

  return (
    <LiveAlertsProvider>
      <div className="flex min-h-svh bg-muted/30">
        <AppSidebar collapsed={collapsed} drawerOpen={drawerOpen} onDrawerClose={() => setDrawerOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
            <div className="flex h-16 items-center gap-2 px-4">
              <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label={t('app.toggleMenu')}>
                <PanelLeft />
              </Button>
              <Brand className="md:hidden" />
              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </LiveAlertsProvider>
  )
}
