import { describe, expect, it } from 'vitest'

import { Prisma } from '../generated/prisma/client.js'
import { violatedUniqueConstraint } from './prisma-errors.js'

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test', meta })
}

describe('violatedUniqueConstraint', () => {
  it('names the unique constraint a write violated', () => {
    const error = knownError('P2002', {
      driverAdapterError: { cause: { constraint: { index: 'users_email_key' } } },
    })

    expect(violatedUniqueConstraint(error)).toBe('users_email_key')
  })

  it.each([
    ['another Prisma error', knownError('P2003', {})],
    ['a unique violation without adapter details', knownError('P2002')],
    ['a plain error', new Error('users_email_key')],
    ['not an error at all', 'users_email_key'],
  ])('is undefined for %s', (_case, error) => {
    expect(violatedUniqueConstraint(error)).toBeUndefined()
  })
})
