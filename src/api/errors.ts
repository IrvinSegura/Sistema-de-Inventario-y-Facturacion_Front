import i18n, { type MessageKey } from '@/i18n'

// The API answers every error with an RFC 9457 ProblemDetail; validation errors add field messages.
export interface Problem {
  status?: number
  detail?: string
  errors?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(status: number, problem: Problem | undefined) {
    super(problem?.detail ?? i18n.t('errors.requestFailed', { status }))
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = problem?.errors ?? {}
  }
}

// The API's messages are in English: known ones get their own translation, anything else a
// translated message for its status, so the screen never mixes languages.
const knownApiMessages: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^Invalid credentials$/, () => i18n.t('apiErrors.invalidCredentials')],
  [/^Invalid or expired code$/, () => i18n.t('apiErrors.invalidResetCode')],
  [/^At least one active admin is required$/, () => i18n.t('apiErrors.lastActiveAdmin')],
  [/^Open your cash drawer before selling$/, () => i18n.t('apiErrors.openDrawerFirst')],
  [/^Your cash drawer for today is closed$/, () => i18n.t('apiErrors.drawerClosedToday')],
  [/^Your cash drawer is already open$/, () => i18n.t('apiErrors.drawerAlreadyOpen')],
  [/^Today's cash drawer is already closed$/, () => i18n.t('apiErrors.todaysDrawerClosed')],
  [/^Cash drawer is already closed$/, () => i18n.t('apiErrors.drawerAlreadyClosed')],
  [/^Close your cash drawer of (\S+) first$/, ([, date]) => i18n.t('apiErrors.closePreviousDrawer', { date })],
  [/^Insufficient stock for product: (\d+)$/, ([, id]) => i18n.t('apiErrors.insufficientStock', { id })],
  [/^Product is inactive: (\d+)$/, ([, id]) => i18n.t('apiErrors.productInactive', { id })],
  [/^The resource was modified by another user/, () => i18n.t('apiErrors.staleVersion')],
  [/^Image must be PNG, JPEG, WebP or GIF$/, () => i18n.t('apiErrors.imageType')],
  [/^Maximum upload size exceeded/, () => i18n.t('apiErrors.imageTooLarge')],
  [/^Image uploads are not configured$/, () => i18n.t('apiErrors.imageUploadsOff')],
  [/^Image file is required$/, () => i18n.t('apiErrors.imageRequired')],
  [/^Product not found/, () => i18n.t('apiErrors.productNotFound')],
  [/^Category (not found|is inactive)$/, () => i18n.t('products.form.categoryUnavailable')],
  [/^SKU already exists$/, () => i18n.t('products.form.skuTaken')],
  [/^Name already exists$/, () => i18n.t('products.form.nameTaken')],
  [/^Product has stock movements/, () => i18n.t('products.delete.inUse')],
  [/^Category name already exists$/, () => i18n.t('categories.form.nameTaken')],
  [/^Category has active products/, () => i18n.t('apiErrors.categoryHasProducts')],
  [/^Barcode already exists$/, () => i18n.t('products.form.barcodeTaken')],
  [/^Tax ID already exists$/, () => i18n.t('customers.form.taxIdTaken')],
  [/^Tax ID, fiscal postal code and tax regime must be given together$/, () => i18n.t('apiErrors.incompleteFiscalData')],
  [/^Unknown tax regime$/, () => i18n.t('apiErrors.unknownTaxRegime')],
  [/^The tax regime doesn't apply to a company/, () => i18n.t('customers.form.regimeNotForCompanies')],
  [/^The tax regime doesn't apply to an individual/, () => i18n.t('customers.form.regimeNotForIndividuals')],
  [/^Customer has sales/, () => i18n.t('customers.delete.inUse')],
  [/^Customer not found$/, () => i18n.t('apiErrors.customerNotFound')],
  [/^Customer is inactive$/, () => i18n.t('apiErrors.customerInactive')],
  [/^The walk-in customer can't be (modified|deleted)$/, () => i18n.t('apiErrors.walkInReadOnly')],
  [/^Email is already registered$/, () => i18n.t('users.form.emailTaken')],
  [/^User not found$/, () => i18n.t('apiErrors.userNotFound')],
  [/^Current password is incorrect$/, () => i18n.t('apiErrors.wrongCurrentPassword')],
  [/^(No open cash drawer|Cash drawer not found)$/, () => i18n.t('apiErrors.noOpenDrawer')],
  [/^Sale total exceeds the maximum allowed$/, () => i18n.t('apiErrors.saleTooLarge')],
  [/^Each product can appear only once per sale$/, () => i18n.t('apiErrors.duplicateSaleLine')],
  [/^Idempotency-Key was already used with a different request$/, () => i18n.t('apiErrors.keyReused')],
]

const statusMessages: Partial<Record<number, MessageKey>> = {
  400: 'errors.badRequest',
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  413: 'apiErrors.imageTooLarge',
  429: 'errors.tooManyRequests',
}

function translateApiMessage(message: string, status: number): string {
  for (const [pattern, translate] of knownApiMessages) {
    const match = message.match(pattern)
    if (match) {
      return translate(match)
    }
  }
  const key = statusMessages[status]
  return key ? i18n.t(key) : i18n.t('errors.requestFailed', { status })
}

// Message for a toast or form; network failures (API asleep or offline) get a friendly hint.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 503 ? i18n.t('errors.busy') : translateApiMessage(error.message, error.status)
  }
  if (error instanceof TypeError) {
    return i18n.t('errors.network')
  }
  return i18n.t('errors.generic')
}
