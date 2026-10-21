import { describe, expect, it } from 'vitest'

import { updateRequestFrom } from './customer-update'

const customer = {
  id: 4,
  name: 'Ferretería Juárez',
  taxId: 'FJU010203AB1',
  fiscalPostalCode: '06600',
  taxRegime: '601',
  email: 'compras@ferreteria.mx',
  phone: '5512345678',
  address: 'Av. Juárez 10',
  active: true,
  version: 3,
}

describe('updateRequestFrom', () => {
  it('keeps the fiscal data and everything else when deactivating', () => {
    expect(updateRequestFrom(customer, { active: false })).toEqual({ ...customer, active: false })
  })

  it('sends the version it read, so a newer edit is not overwritten', () => {
    expect(updateRequestFrom(customer).version).toBe(3)
  })
})
