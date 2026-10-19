import { Navigate, Outlet } from 'react-router'

import { type Role, useUser } from './auth-context'

// UX only: the API enforces roles anyway. Other users go back to the dashboard.
export function RequireRole({ roles }: { roles: Role[] }) {
  const user = useUser()
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />
}
