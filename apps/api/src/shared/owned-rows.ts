import { Prisma } from '../generated/prisma/client.js'

type Transaction = Prisma.TransactionClient

/** Tables whose rows belong to a user (they have `user_id`). */
export type OwnedTable = 'properties' | 'brokers' | 'bookings'

/**
 * Locks the user's row for the rest of the transaction (`SELECT … FOR UPDATE`). Returns
 * false when the user has no such row. Use it to read-decide-write without a concurrent
 * update slipping in between.
 */
export async function lockOwnedRow(
  tx: Transaction,
  table: OwnedTable,
  id: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM ${Prisma.raw(`"${table}"`)}
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    FOR UPDATE
  `
  return rows.length === 1
}
