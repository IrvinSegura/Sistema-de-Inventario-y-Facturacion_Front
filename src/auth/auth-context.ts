import { createContext, use } from 'react'

export type Role = 'ADMIN' | 'SUPERVISOR' | 'SELLER'

/** Admins and supervisors run the store (catalog, stock, every seller's sales); only admins manage accounts. */
export function managesStore(role: Role): boolean {
  return role === 'ADMIN' || role === 'SUPERVISOR'
}

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User }

export interface Auth {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const auth = use(AuthContext)
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return auth
}

/** For screens that only render when signed in (behind <RequireAuth>); throws otherwise. */
export function useUser(): User {
  const { state } = useAuth()
  if (state.status !== 'signed-in') {
    throw new Error('useUser needs a signed-in user')
  }
  return state.user
}
