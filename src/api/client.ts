import createClient, { type Middleware } from 'openapi-fetch'

import { ApiError, type Problem } from './errors'
import type { components, paths } from './schema'
import { session } from './session'

export type Schemas = components['schemas']

const baseUrl = import.meta.env.VITE_API_URL

let onSessionExpired: () => void = () => {}

/**
 * Replaces the handler run when an authenticated call gets a 401 and the session can't be renewed,
 * so the app can go back to the login screen.
 */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

// Refresh tokens are rotated on every use and reusing an old one revokes every session, so two
// refreshes must never send the same token: one at a time per tab (shared promise) and across tabs
// (Web Lock), always with the token currently stored, which another tab may already have rotated.
let refreshing: Promise<boolean> | null = null

/**
 * Renews the tokens with the stored refresh token: true once the new ones are stored, false without a
 * token or when the API refuses (only a 401 also clears the session); a network failure rejects.
 * Calls made meanwhile share it.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= navigator.locks
    .request('inventory.refresh', async () => {
      const refreshToken = session.refreshToken()
      if (!refreshToken) {
        return false
      }
      const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!response.ok) {
        // Only a rejected token (401) clears the session here; other failures (e.g. a 5xx) leave it to the caller.
        if (response.status === 401) {
          session.clear()
        }
        return false
      }
      const tokens = (await response.json()) as Schemas['TokenResponse']
      session.store({ accessToken: tokens.accessToken!, refreshToken: tokens.refreshToken! })
      return true
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// Unsent copies of authenticated requests: sending consumes the body, so a retry needs its own.
const unsent = new WeakMap<Request, Request>()

/**
 * Adds the access token. A 401 on an authenticated call means it expired: renew it once
 * and retry with the same body and headers (a sale keeps its Idempotency-Key, so it isn't doubled).
 */
const auth: Middleware = {
  onRequest({ request }) {
    const token = session.accessToken()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
      unsent.set(request, request.clone())
    }
    return request
  },

  async onResponse({ request, response, options }) {
    const copy = unsent.get(request)
    if (response.status !== 401 || !copy) {
      return response
    }
    if (!(await refreshSession())) {
      onSessionExpired()
      return response
    }
    copy.headers.set('Authorization', `Bearer ${session.accessToken()}`)
    return options.fetch(copy)
  },
}

/** Typed API client; pass its calls to unwrap. An expired session is renewed once per call and the call retried. */
export const api = createClient<paths>({ baseUrl })
api.use(auth)

/** Unwraps an openapi-fetch result: the data, or throws an ApiError with the ProblemDetail. */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) {
    throw new ApiError(response.status, error as Problem | undefined)
  }
  return data as T
}
