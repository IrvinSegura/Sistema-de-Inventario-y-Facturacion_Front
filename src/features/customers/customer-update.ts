import type { Customer, UpdateCustomer } from './queries'

// Every key of the request, the optional ones too: the PUT replaces every field, so a field the API
// adds must be mapped below or the build fails, instead of being erased on the next save.
type CompleteUpdate = { [K in keyof Required<UpdateCustomer>]: UpdateCustomer[K] }

/** The customer as it is, as an update request, with `changes` on top (e.g. active: false). */
export function updateRequestFrom(customer: Customer, changes: Partial<UpdateCustomer> = {}): CompleteUpdate & { id: number } {
  const current: CompleteUpdate = {
    name: customer.name!,
    taxId: customer.taxId,
    fiscalPostalCode: customer.fiscalPostalCode,
    taxRegime: customer.taxRegime,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    active: customer.active!,
    version: customer.version!,
  }
  return { id: customer.id!, ...current, ...changes }
}
