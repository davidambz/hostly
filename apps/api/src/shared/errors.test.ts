import { describe, expect, it } from 'vitest'

import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from './errors.js'

describe('domain errors', () => {
  it.each([
    [BadRequestError, 400, 'BAD_REQUEST'],
    [UnauthorizedError, 401, 'UNAUTHORIZED'],
    [ForbiddenError, 403, 'FORBIDDEN'],
    [NotFoundError, 404, 'NOT_FOUND'],
    [ConflictError, 409, 'CONFLICT'],
  ])('%o maps to %i %s', (ErrorClass, statusCode, code) => {
    const error = new ErrorClass('something happened', { field: 'x' })

    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
    expect(error.statusCode).toBe(statusCode)
    expect(error.code).toBe(code)
    expect(error.name).toBe(ErrorClass.name)
    expect(error.message).toBe('something happened')
    expect(error.details).toEqual({ field: 'x' })
  })

  it('leaves details undefined when none are given', () => {
    expect(new NotFoundError('missing').details).toBeUndefined()
  })
})
