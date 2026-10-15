import i18n from '@/i18n'

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

// The API's messages are in English; the ones a cashier sees often are translated, anything else is
// shown as it comes (still meaningful, just untranslated).
const knownApiMessages: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^Invalid credentials$/, () => i18n.t('apiErrors.invalidCredentials')],
  [/^At least one active admin is required$/, () => i18n.t('apiErrors.lastActiveAdmin')],
  [/^Open your cash drawer before selling$/, () => i18n.t('apiErrors.openDrawerFirst')],
  [/^Your cash drawer for today is closed$/, () => i18n.t('apiErrors.drawerClosedToday')],
  [/^Your cash drawer is already open$/, () => i18n.t('apiErrors.drawerAlreadyOpen')],
  [/^Today's cash drawer is already closed$/, () => i18n.t('apiErrors.todaysDrawerClosed')],
  [/^Cash drawer is already closed$/, () => i18n.t('apiErrors.drawerAlreadyClosed')],
  [/^Close your cash drawer of (\S+) first$/, ([, date]) => i18n.t('apiErrors.closePreviousDrawer', { date })],
  [/^Insufficient stock for product: (\d+)$/, ([, id]) => i18n.t('apiErrors.insufficientStock', { id })],
  [/^Product is inactive: (\d+)$/, ([, id]) => i18n.t('apiErrors.productInactive', { id })],
]

function translateApiMessage(message: string): string {
  for (const [pattern, translate] of knownApiMessages) {
    const match = message.match(pattern)
    if (match) {
      return translate(match)
    }
  }
  return message
}

// Message for a toast or form; network failures (API asleep or offline) get a friendly hint.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 503 ? i18n.t('errors.busy') : translateApiMessage(error.message)
  }
  if (error instanceof TypeError) {
    return i18n.t('errors.network')
  }
  return i18n.t('errors.generic')
}
