import { fromCents, lineTaxCents, toCents } from '@/lib/money'

export interface CartLine {
  productId: number
  sku: string
  name: string
  unitPrice: number
  taxRate: number
  quantity: number
  /** Stock when the product was scanned; the server has the final word. */
  stock: number
}

export type CartAction =
  | { type: 'add'; line: Omit<CartLine, 'quantity'> }
  | { type: 'setQuantity'; productId: number; quantity: number }
  | { type: 'remove'; productId: number }
  | { type: 'clear' }

/**
 * Scanning a product already in the cart adds one unit instead of a second line: the API rejects
 * a sale with the same product twice. Setting a quantity below 1 removes the line.
 */
export function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const existing = lines.find((line) => line.productId === action.line.productId)
      if (existing) {
        return lines.map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line)
      }
      return [...lines, { ...action.line, quantity: 1 }]
    }
    case 'setQuantity':
      if (action.quantity < 1) {
        return lines.filter((line) => line.productId !== action.productId)
      }
      return lines.map((line) => line.productId === action.productId ? { ...line, quantity: action.quantity } : line)
    case 'remove':
      return lines.filter((line) => line.productId !== action.productId)
    case 'clear':
      return []
  }
}

export interface CartTotals {
  subtotal: number
  tax: number
  total: number
}

/** Preview with the API's rule (tax per line, HALF_UP); the receipt shows the server's totals. */
export function cartTotals(lines: CartLine[]): CartTotals {
  let subtotalCents = 0
  let taxCents = 0
  for (const line of lines) {
    const lineSubtotal = toCents(line.unitPrice) * line.quantity
    subtotalCents += lineSubtotal
    taxCents += lineTaxCents(lineSubtotal, line.taxRate)
  }
  return {
    subtotal: fromCents(subtotalCents),
    tax: fromCents(taxCents),
    total: fromCents(subtotalCents + taxCents),
  }
}
