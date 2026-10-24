import { Navigate, Outlet, useLocation } from 'react-router'

import { FullPageSpinner } from '@/components/FullPageSpinner'

import { CHANGE_PASSWORD_PATH, useAuth } from './auth-context'

/**
 * Routes behind it need a session; while it's being restored, nothing flashes. Signed-out users go to
 * /login, which sends them back to the page they asked for; a user who must change a temporary
 * password can only reach CHANGE_PASSWORD_PATH (the API refuses everything else anyway).
 */
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <FullPageSpinner />
  }
  if (state.status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (state.user.passwordChangeRequired && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />
  }
  return <Outlet />
}
