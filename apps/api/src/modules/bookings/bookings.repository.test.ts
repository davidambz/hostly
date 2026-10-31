import { describe, expect, it, vi } from 'vitest'

import { Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { ExclusionConflictError } from '../../shared/database-errors.js'
import { BookingsRepository } from './bookings.repository.js'

function driverError(code: string, cause: object) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: 'test',
    meta: { driverAdapterError: { cause } },
  })
}

function repositoryWhoseCreateFailsWith(error: unknown) {
  const db = { booking: { create: vi.fn().mockRejectedValue(error) } }
  return new BookingsRepository(db as unknown as Database)
}

const data = {
  propertyId: 'p1',
  guestName: 'X',
  checkIn: new Date(),
  checkOut: new Date(),
  nightlyRate: 1,
}

describe('BookingsRepository.create errors', () => {
  it('reports an overlap as an ExclusionConflictError', async () => {
    const error = driverError('P2039', { originalCode: '23P01' })

    await expect(repositoryWhoseCreateFailsWith(error).create('u1', data)).rejects.toBeInstanceOf(
      ExclusionConflictError,
    )
  })

  it.each([
    ['bookings_property_id_user_id_fkey', 'propertyId'],
    ['bookings_broker_id_user_id_fkey', 'brokerId'],
  ])('reports %s as a missing %s', async (index, field) => {
    const error = driverError('P2003', { constraint: { index } })

    await expect(repositoryWhoseCreateFailsWith(error).create('u1', data)).rejects.toMatchObject({
      name: 'MissingReferenceError',
      field,
    })
  })

  it('lets an unknown foreign key and any other error through untouched', async () => {
    const unknownKey = driverError('P2003', { constraint: { index: 'bookings_user_id_fkey' } })
    const other = new Error('connection reset')

    await expect(repositoryWhoseCreateFailsWith(unknownKey).create('u1', data)).rejects.toBe(
      unknownKey,
    )
    await expect(repositoryWhoseCreateFailsWith(other).create('u1', data)).rejects.toBe(other)
  })
})
