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
  abstract readonly statusCode: number
  protected abstract readonly defaultCode: string
  readonly details?: unknown
  private readonly customCode?: string

  constructor(message: string, { code, details }: AppErrorOptions = {}) {
    super(message)
    this.name = new.target.name
    this.customCode = code
    this.details = details
  }

  get code(): string {
    return this.customCode ?? this.defaultCode
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400
  protected readonly defaultCode = 'BAD_REQUEST'
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401
  protected readonly defaultCode = 'UNAUTHORIZED'
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403
  protected readonly defaultCode = 'FORBIDDEN'
}

export class NotFoundError extends AppError {
  readonly statusCode = 404
  protected readonly defaultCode = 'NOT_FOUND'
}

export class ConflictError extends AppError {
  readonly statusCode = 409
  protected readonly defaultCode = 'CONFLICT'
}
