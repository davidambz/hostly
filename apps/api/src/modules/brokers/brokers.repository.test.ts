import { describe, expect, it, vi } from 'vitest'

import { Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { RowInUseError } from '../../shared/database-errors.js'
import { BrokersRepository } from './brokers.repository.js'

function repositoryWhoseDeleteFailsWith(error: unknown) {
  const db = { broker: { deleteMany: vi.fn().mockRejectedValue(error) } }
  return new BrokersRepository(db as unknown as Database)
}

describe('BrokersRepository.delete', () => {
  it('reports a foreign key violation as a RowInUseError', async () => {
    const violation = new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', {
      code: 'P2003',
      clientVersion: 'test',
    })

    await expect(
      repositoryWhoseDeleteFailsWith(violation).delete('u1', 'p1'),
    ).rejects.toBeInstanceOf(RowInUseError)
  })

  it('lets any other error through untouched', async () => {
    const failure = new Error('connection reset')

    await expect(repositoryWhoseDeleteFailsWith(failure).delete('u1', 'p1')).rejects.toBe(failure)
  })
})
