// Tokens of the signed-in user. The access token lives only in memory; the refresh token is kept in
// localStorage so a reload doesn't sign the user out (trade-off: readable by injected scripts; an
// httpOnly cookie set by the API would remove that risk).
const REFRESH_TOKEN_KEY = 'inventory.refreshToken'

let accessToken: string | null = null

export const session = {
  accessToken: () => accessToken,

  refreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  store(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  },

  clear() {
    accessToken = null
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}
