/** Body of every error response the API sends. */
export interface ErrorResponse {
  statusCode: number
  code: string
  message: string
  details?: unknown
}

/** One entry of `details` in a `VALIDATION_ERROR` response. */
export interface ValidationIssue {
  /** Where the invalid value came from: `body`, `querystring`, `params` or `headers`. */
  location: string
  /** Dotted path to the field, e.g. `address.zip`; empty when the whole input is invalid. */
  path: string
  message: string
}
