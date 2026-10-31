import { describe, expect, it } from 'vitest'

import { Prisma } from '../generated/prisma/client.js'
import { isExclusionViolation, uniqueViolation, violates } from './prisma-errors.js'

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
  function exclusion(constraint: string, code = '23P01') {
    return knownError('P2039', {
      driverAdapterError: {
        cause: {
          originalCode: code,
          originalMessage: `conflicting key value violates exclusion constraint "${constraint}"`,
        },
      },
    })
  }

  it('recognizes a violation of the named exclusion constraint', () => {
    expect(isExclusionViolation(exclusion('bookings_no_overlap'), 'bookings_no_overlap')).toBe(true)
  })

  it.each([
    ['another constraint', exclusion('other_no_overlap')],
    ['a constraint whose name contains it', exclusion('bookings_no_overlap_v2')],
    ['another Postgres error', exclusion('bookings_no_overlap', '23514')],
    ['an error without driver details', knownError('P2039')],
    ['a plain error', new Error('bookings_no_overlap')],
  ])('is false for %s', (_case, error) => {
    expect(isExclusionViolation(error, 'bookings_no_overlap')).toBe(false)
  })
})
