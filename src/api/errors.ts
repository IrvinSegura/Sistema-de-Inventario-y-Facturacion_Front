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
    super(problem?.detail ?? `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = problem?.errors ?? {}
  }
}

// Message for a toast or form; network failures (API asleep or offline) get a friendly hint.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 503 ? 'The server is busy, please retry.' : error.message
  }
  if (error instanceof TypeError) {
    return 'Cannot reach the server. Check your connection and retry.'
  }
  return 'Something went wrong.'
}
