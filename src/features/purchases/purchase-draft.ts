import { fromCents, toCents } from '@/lib/money'

// Same limits as the API (CreatePurchaseRequest, LineLimits, PurchaseService.MAX_TOTAL).
export const MAX_LINES = 200
export const MAX_QUANTITY = 100_000
export const MAX_UNIT_COST = 99_999.99
export const MAX_TOTAL = 9_999_999_999.99

// One product of a purchase being written. Quantity and cost are kept as typed, so a half-written
// number ("12.") doesn't jump while editing.
export interface DraftLine {
  productId: number
  sku: string
  name: string
  // Unknown when the line comes from a repeated purchase or a report without prices.
  stock?: number
  salePrice?: number
  quantity: string
  unitCost: string
}

export type DraftAction =
  | { type: 'add'; line: Omit<DraftLine, 'quantity' | 'unitCost'> & Partial<Pick<DraftLine, 'quantity' | 'unitCost'>> }
  | { type: 'update'; productId: number; field: 'quantity' | 'unitCost'; value: string }
  | { type: 'remove'; productId: number }
  | { type: 'clear' }

// A product appears once per purchase (the API rejects duplicates): adding it again adds a unit.
export function draftReducer(lines: DraftLine[], action: DraftAction): DraftLine[] {
  switch (action.type) {
    case 'add': {
      const existing = lines.find((line) => line.productId === action.line.productId)
      if (existing) {
        const quantity = parseQuantity(existing.quantity)
        return lines.map((line) => line === existing
          ? { ...line, quantity: String(quantity === null ? 1 : Math.min(quantity + 1, MAX_QUANTITY)) }
          : line)
      }
      if (lines.length >= MAX_LINES) {
        return lines
      }
      return [...lines, { quantity: '1', unitCost: '', ...action.line }]
    }
    case 'update':
      return lines.map((line) => line.productId === action.productId ? { ...line, [action.field]: action.value } : line)
    case 'remove':
      return lines.filter((line) => line.productId !== action.productId)
    case 'clear':
      return []
  }
}

// Whole units from 1 to MAX_QUANTITY, or null.
export function parseQuantity(value: string): number | null {
  const text = value.trim()
  if (!/^\d+$/.test(text)) {
    return null
  }
  const quantity = Number(text)
  return quantity >= 1 && quantity <= MAX_QUANTITY ? quantity : null
}

// Pesos with up to 2 decimals from 0 to MAX_UNIT_COST, or null.
export function parseUnitCost(value: string): number | null {
  const text = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null
  }
  const cost = Number(text)
  return cost <= MAX_UNIT_COST ? cost : null
}

export interface DraftTotals {
  // Lines with a valid quantity and cost.
  validLines: number
  units: number
  total: number
}

// Works in integer cents, like the API: the total is the sum of quantity * unit cost.
export function draftTotals(lines: DraftLine[]): DraftTotals {
  let cents = 0
  let units = 0
  let validLines = 0
  for (const line of lines) {
    const quantity = parseQuantity(line.quantity)
    const cost = parseUnitCost(line.unitCost)
    if (quantity !== null && cost !== null) {
      cents += quantity * toCents(cost)
      units += quantity
      validLines++
    }
  }
  return { validLines, units, total: fromCents(cents) }
}

export function lineSubtotal(line: DraftLine): number | null {
  const quantity = parseQuantity(line.quantity)
  const cost = parseUnitCost(line.unitCost)
  return quantity === null || cost === null ? null : fromCents(quantity * toCents(cost))
}

// Share of the sale price left after the cost (both without VAT); null without a price.
export function margin(line: DraftLine): number | null {
  const cost = parseUnitCost(line.unitCost)
  if (cost === null || !line.salePrice) {
    return null
  }
  return (line.salePrice - cost) / line.salePrice
}

export interface SupplierRef {
  id: number
  name: string
  taxId?: string
}

export type NewDraftLine = Extract<DraftAction, { type: 'add' }>['line']

// Router state that opens the new purchase prefilled: from a supplier, a repeated purchase or the
// low-stock report.
export interface DraftState {
  supplier?: SupplierRef
  lines?: NewDraftLine[]
}
