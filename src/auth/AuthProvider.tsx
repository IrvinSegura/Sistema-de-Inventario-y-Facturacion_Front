import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { api, refreshSession, setSessionExpiredHandler, unwrap } from '@/api/client'
import { session } from '@/api/session'
import i18n from '@/i18n'

import { type Auth, AuthContext, type AuthState, type User } from './auth-context'

async function fetchCurrentUser(): Promise<User> {
  const me = await unwrap(api.GET('/api/v1/users/me'))
  return { id: me.id!, name: me.name!, email: me.email!, role: me.role!, passwordChangeRequired: me.passwordChangeRequired! }
}

/**
 * Provides useAuth. On load it restores the session from the stored refresh token (quietly signed out
 * if it can't); when an authenticated call later can't renew it, it signs out, clears the query cache
 * and says so in a toast.
 */
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
    // Keeps the stored refresh token, so after a network failure a reload can still restore the session.
    restore().catch(() => !cancelled && setState({ status: 'signed-out' }))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      signOutLocally()
      toast.info(i18n.t('session.expired'))
    })
  }, [signOutLocally])

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await unwrap(api.POST('/api/v1/auth/login', { body: { email, password } }))
    session.store({ accessToken: tokens.accessToken!, refreshToken: tokens.refreshToken! })
    setState({ status: 'signed-in', user: await fetchCurrentUser() })
  }, [])

  // The API ends every session on a password change, so this one signs in again with the new password.
  // The email is read fresh: an admin may have changed it since this session started.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { email } = await fetchCurrentUser()
    await unwrap(api.PUT('/api/v1/users/me/password', { body: { currentPassword, newPassword } }))
    // The stored tokens are already revoked: dropping them keeps them off the sign-in request.
    session.clear()
    try {
      await login(email, newPassword)
    } catch (error) {
      // The password did change and this session is already revoked: signing in by hand is the way on.
      signOutLocally()
      toast.info(i18n.t('changePassword.signInAgain'))
      throw error
    }
  }, [login, signOutLocally])

  // Revokes the refresh token on the server; signs out locally even if that call fails.
  const logout = useCallback(async () => {
    const refreshToken = session.refreshToken()
    if (refreshToken) {
      await api.POST('/api/v1/auth/logout', { body: { refreshToken } }).catch(() => undefined)
    }
    signOutLocally()
  }, [signOutLocally])

  const auth = useMemo<Auth>(() => ({ state, login, changePassword, logout }), [state, login, changePassword, logout])
  return <AuthContext value={auth}>{children}</AuthContext>
}
