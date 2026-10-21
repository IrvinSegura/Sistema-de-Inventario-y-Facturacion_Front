import type { Customer } from './queries'

/** SAT catalog c_RegimenFiscal, as the API accepts it (TaxRegime): who each regime applies to. */
export const TAX_REGIMES = [
  { code: '601', individuals: false, companies: true },
  { code: '603', individuals: false, companies: true },
  { code: '605', individuals: true, companies: false },
  { code: '606', individuals: true, companies: false },
  { code: '607', individuals: true, companies: false },
  { code: '608', individuals: true, companies: false },
  { code: '610', individuals: true, companies: true },
  { code: '611', individuals: true, companies: false },
  { code: '612', individuals: true, companies: false },
  { code: '614', individuals: true, companies: false },
  { code: '615', individuals: true, companies: false },
  { code: '616', individuals: true, companies: false },
  { code: '620', individuals: false, companies: true },
  { code: '621', individuals: true, companies: false },
  { code: '622', individuals: false, companies: true },
  { code: '623', individuals: false, companies: true },
  { code: '624', individuals: false, companies: true },
  { code: '625', individuals: true, companies: false },
  { code: '626', individuals: true, companies: true },
] as const

export type TaxRegimeCode = (typeof TAX_REGIMES)[number]['code']

// RFC length: 12 characters for a company, 13 for an individual.
const COMPANY_TAX_ID_LENGTH = 12

/** Judged by length alone, so only meaningful for a well-formed RFC. */
export function isCompanyTaxId(taxId: string): boolean {
  return taxId.length === COMPANY_TAX_ID_LENGTH
}

export function isTaxRegimeCode(code: string): code is TaxRegimeCode {
  return TAX_REGIMES.some((regime) => regime.code === code)
}

/** Whether the regime fits the RFC's kind (company or individual); expects a well-formed RFC. */
export function regimeAppliesTo(code: TaxRegimeCode, taxId: string): boolean {
  const regime = TAX_REGIMES.find((candidate) => candidate.code === code)!
  return isCompanyTaxId(taxId) ? regime.companies : regime.individuals
}

/** An invoice (CFDI 4.0) needs the tax ID, the fiscal postal code and the tax regime. */
export function isInvoiceable(customer: Pick<Customer, 'taxId' | 'fiscalPostalCode' | 'taxRegime'>): boolean {
  return !!customer.taxId && !!customer.fiscalPostalCode && !!customer.taxRegime
}
