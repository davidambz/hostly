/** The API's error body: `{ statusCode, code, message, details? }`. */
export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  details?: unknown
}

/** A failed API call. `code` is what to branch on (e.g. `EMAIL_TAKEN`). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, body: Partial<ApiErrorBody> | undefined) {
    super(body?.message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code ?? 'UNKNOWN_ERROR'
    this.details = body?.details
  }
}

/** The field a validation or domain error points at, when it names one. */
export function errorField(error: ApiError): string | undefined {
  const details = error.details
  if (details && typeof details === 'object' && 'field' in details) {
    return typeof details.field === 'string' ? details.field : undefined
  }
  return undefined
}

/**
 * Turns an openapi-fetch result into its data, or throws an ApiError, so callers (and
 * TanStack Query) deal with exceptions instead of `{ data, error }` pairs.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error as Partial<ApiErrorBody> | undefined)
  }
  return result.data as T
}
