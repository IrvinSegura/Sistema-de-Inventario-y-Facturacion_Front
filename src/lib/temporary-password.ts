// No look-alikes (0/O/o, 1/I/l/L): the admin reads it out or writes it down for the user.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
// 12 of 54 symbols is about 69 bits, and well above the API's 8-character minimum.
const LENGTH = 12

/**
 * A random temporary password for an admin to hand over; the user must change it at their next login.
 * Drawn from crypto.getRandomValues, discarding bytes that would bias some symbols.
 */
export function generateTemporaryPassword(length = LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length)
  let password = ''
  while (password.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < limit && password.length < length) {
        password += ALPHABET[byte % ALPHABET.length]
      }
    }
  }
  return password
}
