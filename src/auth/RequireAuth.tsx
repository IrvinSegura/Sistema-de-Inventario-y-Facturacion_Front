import { Navigate, Outlet, useLocation } from 'react-router'

import { FullPageSpinner } from '@/components/FullPageSpinner'

import { useAuth } from './auth-context'

// Routes behind it need a session; while it's being restored, nothing flashes.
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <FullPageSpinner />
  }
  if (state.status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
