import { fromCents, toCents } from '@/lib/money'

export interface Denomination {
  key: string
  value: number
  kind: 'bill' | 'coin'
}

// Mexican pesos in circulation; $20 exists both as a bill and as a coin.
export const denominations: Denomination[] = [
  { key: 'b1000', value: 1000, kind: 'bill' },
  { key: 'b500', value: 500, kind: 'bill' },
  { key: 'b200', value: 200, kind: 'bill' },
  { key: 'b100', value: 100, kind: 'bill' },
  { key: 'b50', value: 50, kind: 'bill' },
  { key: 'b20', value: 20, kind: 'bill' },
  { key: 'c20', value: 20, kind: 'coin' },
  { key: 'c10', value: 10, kind: 'coin' },
  { key: 'c5', value: 5, kind: 'coin' },
  { key: 'c2', value: 2, kind: 'coin' },
  { key: 'c1', value: 1, kind: 'coin' },
  { key: 'c050', value: 0.5, kind: 'coin' },
]

// Pieces per denomination key, as typed: digits only, empty when not counted.
export type DenominationCounts = Record<string, string>

export const MAX_PIECES_DIGITS = 5

// Keeps only digits so a count is always a whole, non-negative number of pieces.
export function cleanCount(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, MAX_PIECES_DIGITS)
}

// Total of the counted pieces, added in cents so 0.50 coins don't drift.
export function countedTotal(counts: DenominationCounts): number {
  const cents = denominations.reduce(
    (sum, denomination) => sum + toCents(denomination.value) * Number(counts[denomination.key] || 0), 0)
  return fromCents(cents)
}
