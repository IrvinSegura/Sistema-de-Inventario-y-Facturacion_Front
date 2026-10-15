import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { api, refreshSession, setSessionExpiredHandler, unwrap } from '@/api/client'
import { session } from '@/api/session'

import { type Auth, AuthContext, type AuthState, type User } from './auth-context'

async function fetchCurrentUser(): Promise<User> {
  const me = await unwrap(api.GET('/api/v1/users/me'))
  return { id: me.id!, name: me.name!, email: me.email!, role: me.role! }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const signOutLocally = useCallback(() => {
    session.clear()
    queryClient.clear()
    setState({ status: 'signed-out' })
  }, [queryClient])

  // A reload keeps only the refresh token: trade it for a new access token and the user.
  useEffect(() => {
    let cancelled = false
    async function restore() {
      const restored = (await refreshSession()) ? await fetchCurrentUser() : null
      if (!cancelled) {
        setState(restored ? { status: 'signed-in', user: restored } : { status: 'signed-out' })
      }
    }
    restore().catch(() => !cancelled && setState({ status: 'signed-out' }))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      signOutLocally()
      toast.info('Your session expired. Please sign in again.')
    })
  }, [signOutLocally])

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await unwrap(api.POST('/api/v1/auth/login', { body: { email, password } }))
    session.store({ accessToken: tokens.accessToken!, refreshToken: tokens.refreshToken! })
    setState({ status: 'signed-in', user: await fetchCurrentUser() })
  }, [])

  // Revokes the refresh token on the server; signs out locally even if that call fails.
  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken()
    if (refreshToken) {
      await api.POST('/api/v1/auth/logout', { body: { refreshToken } }).catch(() => undefined)
    }
    signOutLocally()
  }, [signOutLocally])

  const auth = useMemo<Auth>(() => ({ state, login, logout }), [state, login, logout])
  return <AuthContext value={auth}>{children}</AuthContext>
}
