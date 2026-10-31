import { z } from 'zod'

/** Body of every error response the API sends. */
export const errorResponseSchema = z
  .object({
    statusCode: z.number().int(),
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .meta({ id: 'ErrorResponse' })

export type ErrorResponse = z.infer<typeof errorResponseSchema>

/** One entry of `details` in a `VALIDATION_ERROR` response. */
export interface ValidationIssue {
  /** Where the invalid value came from: `body`, `querystring`, `params` or `headers`. */
  location: string
  /** Dotted path to the field, e.g. `address.zip`; empty when the whole input is invalid. */
  path: string
  message: string
}
