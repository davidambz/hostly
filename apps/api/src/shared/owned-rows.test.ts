import { describe, expect, it, vi } from 'vitest'

import { Prisma } from '../generated/prisma/client.js'
import { RowInUseError } from './database-errors.js'
import { deleteOrFail, deleteOwnedRow, lockOwnedRow, type OwnedTable } from './owned-rows.js'

describe('lockOwnedRow', () => {
  it('refuses a table outside the allow-list, whatever the types say', async () => {
    const tx = { $queryRaw: vi.fn() } as unknown as Prisma.TransactionClient

    await expect(
      lockOwnedRow(tx, 'users; DROP TABLE users' as OwnedTable, 'id', 'u1'),
    ).rejects.toThrow('Not an owned table')
    expect(tx.$queryRaw).not.toHaveBeenCalled()
  })
})

describe('deleteOwnedRow', () => {
  it.each([
    [1, true],
    [0, false],
  ])('reports %i deleted rows as %o', async (count, deleted) => {
    await expect(deleteOwnedRow(() => Promise.resolve({ count }), 'bookings')).resolves.toBe(
      deleted,
    )
  })

  it('turns a foreign key violation into a RowInUseError', async () => {
    const violation = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: 'x',
    })

    await expect(deleteOwnedRow(() => Promise.reject(violation), 'bookings')).rejects.toMatchObject(
      {
        name: 'RowInUseError',
        referencedBy: 'bookings',
      },
    )
  })

  it('lets other errors through', async () => {
    const failure = new Error('connection reset')

    await expect(deleteOwnedRow(() => Promise.reject(failure), 'bookings')).rejects.toBe(failure)
  })
})

describe('deleteOrFail', () => {
  const errors = { notFound: () => new Error('404'), inUse: () => new Error('409') }

  it('resolves when a row was deleted', async () => {
    await expect(deleteOrFail(() => Promise.resolve(true), errors)).resolves.toBeUndefined()
  })

  it('throws notFound when nothing was deleted', async () => {
    await expect(deleteOrFail(() => Promise.resolve(false), errors)).rejects.toThrow('404')
  })

  it('throws inUse for a RowInUseError', async () => {
    await expect(
      deleteOrFail(() => Promise.reject(new RowInUseError('bookings')), errors),
    ).rejects.toThrow('409')
  })

  it('lets other errors through', async () => {
    const failure = new Error('boom')

    await expect(deleteOrFail(() => Promise.reject(failure), errors)).rejects.toBe(failure)
  })
})
