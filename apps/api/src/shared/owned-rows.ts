import { Prisma } from '../generated/prisma/client.js'
import { RowInUseError } from './database-errors.js'
import { isForeignKeyViolation } from './prisma-errors.js'

type Transaction = Prisma.TransactionClient

/**
 * Tables whose rows belong to a user (they have `user_id`), as fixed SQL fragments: the
 * table name never comes from a string at runtime, so it can't be injected.
 */
const OWNED_TABLES = {
  properties: Prisma.sql`"properties"`,
  brokers: Prisma.sql`"brokers"`,
  bookings: Prisma.sql`"bookings"`,
} as const

export type OwnedTable = keyof typeof OWNED_TABLES

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
  const fragment = Object.hasOwn(OWNED_TABLES, table) ? OWNED_TABLES[table] : undefined
  if (!fragment) {
    throw new Error(`Not an owned table: ${JSON.stringify(table)}`)
  }
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM ${fragment}
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid
    FOR UPDATE
  `
  return rows.length === 1
}

/**
 * Runs a scoped delete, turning a foreign key violation (other rows still point at the
 * row) into a RowInUseError. Returns whether a row was deleted.
 */
export async function deleteOwnedRow(
  remove: () => Promise<{ count: number }>,
  referencedBy: string,
): Promise<boolean> {
  try {
    return (await remove()).count === 1
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new RowInUseError(referencedBy)
    }
    throw error
  }
}

/** The service side of a delete: 404 when nothing was deleted, 409 while still in use. */
export async function deleteOrFail(
  remove: () => Promise<boolean>,
  errors: { notFound: () => Error; inUse: () => Error },
): Promise<void> {
  let deleted: boolean
  try {
    deleted = await remove()
  } catch (error) {
    throw error instanceof RowInUseError ? errors.inUse() : error
  }
  if (!deleted) {
    throw errors.notFound()
  }
}
