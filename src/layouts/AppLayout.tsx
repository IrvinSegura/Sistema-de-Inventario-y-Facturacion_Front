import { Outlet } from 'react-router'

import { AppHeader } from './AppHeader'

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
