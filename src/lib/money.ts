const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export function formatMoney(amount: number): string {
  return currency.format(amount)
}

const compactCurrency = new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', notation: 'compact', maximumFractionDigits: 1,
})

// For chart axes: $1.5 K, $2 M.
export function formatMoneyCompact(amount: number): string {
  return compactCurrency.format(amount)
}

// Works in integer cents: adding floats such as 0.1 + 0.2 would drift.
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

// Same rule as the API: line tax = subtotal * rate, rounded HALF_UP to cents. Only a preview; the
// sale's totals always come from the server.
export function lineTaxCents(subtotalCents: number, taxRate: number): number {
  // toFixed(6) drops float noise (e.g. 1005 * 0.16 = 160.79999...) before rounding half up.
  return Math.floor(Number((subtotalCents * taxRate).toFixed(6)) + 0.5)
}

// Unit price plus its VAT, as a one-unit sale line would charge it.
export function withTax(amount: number, taxRate: number): number {
  const cents = toCents(amount)
  return fromCents(cents + lineTaxCents(cents, taxRate))
}
