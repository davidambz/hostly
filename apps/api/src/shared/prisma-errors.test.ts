import { describe, expect, it } from 'vitest'

import { Prisma } from '../generated/prisma/client.js'
import {
  isExclusionViolation,
  uniqueViolation,
  violatedForeignKey,
  violates,
} from './prisma-errors.js'

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test', meta })
}

describe('uniqueViolation', () => {
  it('reads the constraint name reported by the driver adapter', () => {
    const error = knownError('P2002', {
      driverAdapterError: { cause: { constraint: { index: 'users_email_key' } } },
    })

    expect(uniqueViolation(error)).toEqual({ constraint: 'users_email_key', fields: [] })
  })

  it.each([
    ['a list', ['email'], ['email']],
    ['a single field', 'email', ['email']],
  ])("reads Prisma's documented meta.target as %s", (_case, target, fields) => {
    expect(uniqueViolation(knownError('P2002', { target }))).toEqual({
      constraint: undefined,
      fields,
    })
  })

  it('still recognizes a unique violation without any meta', () => {
    expect(uniqueViolation(knownError('P2002'))).toEqual({ constraint: undefined, fields: [] })
  })

  it.each([
    ['another Prisma error', knownError('P2003', {})],
    ['a plain error', new Error('users_email_key')],
    ['not an error at all', 'users_email_key'],
  ])('is undefined for %s', (_case, error) => {
    expect(uniqueViolation(error)).toBeUndefined()
  })
})

describe('violates', () => {
  const field = { table: 'users', field: 'email' }

  it('matches by constraint name', () => {
    expect(violates({ constraint: 'users_email_key', fields: [] }, field)).toBe(true)
  })

  it('matches by field when there is no constraint name', () => {
    expect(violates({ fields: ['email'] }, field)).toBe(true)
  })

  it('does not match another field or table', () => {
    expect(violates({ constraint: 'users_cpf_key', fields: ['cpf'] }, field)).toBe(false)
    expect(violates({ constraint: 'brokers_email_key', fields: [] }, field)).toBe(false)
  })
})

describe('isExclusionViolation', () => {
  function driverError(
    prismaCode: string,
    originalCode: string,
    message = 'any wording, any language',
  ) {
    return knownError(prismaCode, {
      driverAdapterError: { cause: { originalCode, originalMessage: message } },
    })
  }

  it('recognizes Postgres 23P01 by SQLSTATE, whatever the message says', () => {
    expect(isExclusionViolation(driverError('P2039', '23P01', 'conflito de chave'))).toBe(true)
  })

  it.each([
    ['another Postgres error', driverError('P2039', '23514')],
    ['an error without driver details', knownError('P2039')],
    ['a plain error', new Error('23P01')],
  ])('is false for %s', (_case, error) => {
    expect(isExclusionViolation(error)).toBe(false)
  })
})

describe('violatedForeignKey', () => {
  it('names the foreign key reported by the driver', () => {
    const error = knownError('P2003', {
      driverAdapterError: { cause: { constraint: { index: 'bookings_broker_id_user_id_fkey' } } },
    })

    expect(violatedForeignKey(error)).toBe('bookings_broker_id_user_id_fkey')
  })

  it.each([
    ['a foreign key error without details', knownError('P2003')],
    [
      'another Prisma error',
      knownError('P2002', { driverAdapterError: { cause: { constraint: { index: 'x' } } } }),
    ],
    ['a plain error', new Error('fkey')],
  ])('is undefined for %s', (_case, error) => {
    expect(violatedForeignKey(error)).toBeUndefined()
  })
})
