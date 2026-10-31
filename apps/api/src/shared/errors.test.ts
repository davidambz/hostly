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
  ])('%o maps to %i %s by default', (ErrorClass, statusCode, code) => {
    const error = new ErrorClass('something happened')

    expect(error).toBeInstanceOf(AppError)
    expect(error).toBeInstanceOf(Error)
    expect(error.statusCode).toBe(statusCode)
    expect(error.code).toBe(code)
    expect(error.name).toBe(ErrorClass.name)
    expect(error.message).toBe('something happened')
    expect(error.details).toBeUndefined()
  })

  it('takes a specific code and details', () => {
    const error = new ConflictError('E-mail already registered', {
      code: 'EMAIL_TAKEN',
      details: { field: 'email' },
    })

    expect(error.statusCode).toBe(409)
    expect(error.code).toBe('EMAIL_TAKEN')
    expect(error.details).toEqual({ field: 'email' })
  })

  it('keeps the default code when only details are given', () => {
    expect(new NotFoundError('missing', { details: { id: 'x' } }).code).toBe('NOT_FOUND')
  })
})

describe('logging', () => {
  it('keeps code, status and details as own enumerable fields', () => {
    const error = new ConflictError('taken', { code: 'EMAIL_TAKEN', details: { field: 'email' } })

    expect(JSON.parse(JSON.stringify(error))).toMatchObject({
      code: 'EMAIL_TAKEN',
      statusCode: 409,
      details: { field: 'email' },
    })
  })
})
