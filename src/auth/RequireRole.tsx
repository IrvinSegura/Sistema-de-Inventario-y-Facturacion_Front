import { Navigate, Outlet } from 'react-router'

import { type Role, useUser } from './auth-context'

/**
 * UX only: the API enforces roles anyway. Users without one of the roles go back to the dashboard.
 * Needs a signed-in user, so it goes inside RequireAuth.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const user = useUser()
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />
}
