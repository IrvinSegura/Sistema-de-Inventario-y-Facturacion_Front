import createClient, { type Middleware } from 'openapi-fetch'

import { ApiError, type Problem } from './errors'
import type { components, paths } from './schema'
import { session } from './session'

export type Schemas = components['schemas']

const baseUrl = import.meta.env.VITE_API_URL

// Called when the session can't be renewed, so the app can go back to the login screen.
let onSessionExpired: () => void = () => {}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

// Refresh tokens are rotated on every use and reusing an old one revokes every session, so two
// refreshes must never send the same token: one at a time per tab (shared promise) and across tabs
// (Web Lock), always with the token currently stored, which another tab may already have rotated.
let refreshing: Promise<boolean> | null = null

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
        // Only a rejected token ends the session; a network error leaves it for the next try.
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

// Adds the access token. A 401 on an authenticated call means it expired (15 min): renew it once
// and retry with the same body and headers (a sale keeps its Idempotency-Key, so it isn't doubled).
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

export const api = createClient<paths>({ baseUrl })
api.use(auth)

// Unwraps an openapi-fetch result: the data, or an ApiError with the ProblemDetail.
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) {
    throw new ApiError(response.status, error as Problem | undefined)
  }
  return data as T
}
