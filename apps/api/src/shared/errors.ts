/**
 * Domain errors. Services throw these and the error handler turns them into
 * the standard error response, so no route has to build error replies by hand.
 */

export interface AppErrorOptions {
  /** A specific code for clients to branch on (e.g. `EMAIL_TAKEN`); defaults to the generic one. */
  code?: string
  details?: unknown
}

export abstract class AppError extends Error {
  // Plain own fields (not getters), so they show up when the error is logged or serialized.
  readonly code: string
  readonly details?: unknown

  protected constructor(
    readonly statusCode: number,
    defaultCode: string,
    message: string,
    { code, details }: AppErrorOptions = {},
  ) {
    super(message)
    this.name = new.target.name
    this.code = code ?? defaultCode
    this.details = details
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(400, 'BAD_REQUEST', message, options)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(401, 'UNAUTHORIZED', message, options)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(403, 'FORBIDDEN', message, options)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(404, 'NOT_FOUND', message, options)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super(409, 'CONFLICT', message, options)
  }
}
