import { Prisma } from '../generated/prisma/client.js'

interface UniqueViolationMeta {
  /** Set by the driver adapter (`@prisma/adapter-pg`): the violated index. */
  driverAdapterError?: { cause?: { constraint?: { index?: string } } }
  /** Documented by Prisma: the fields of the violated constraint. */
  target?: string | string[]
}

export interface UniqueViolation {
  /** e.g. `users_email_key`, when the driver reports it. */
  constraint?: string
  /** e.g. `['email']`, when Prisma reports it. */
  fields: string[]
}

/**
 * Details of a unique-constraint violation (P2002), or undefined for any other error.
 * Reads both the adapter's constraint name and Prisma's documented `meta.target`, so
 * callers can match either one and don't depend on a single, internal shape.
 */
export function uniqueViolation(error: unknown): UniqueViolation | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined
  }
  const meta = (error.meta ?? {}) as UniqueViolationMeta
  const target = meta.target
  return {
    constraint: meta.driverAdapterError?.cause?.constraint?.index,
    fields: typeof target === 'string' ? [target] : (target ?? []),
  }
}

/** Whether `violation` is about the unique constraint on `field` of `table`. */
export function violates(
  violation: UniqueViolation,
  { table, field }: { table: string; field: string },
): boolean {
  return violation.constraint === `${table}_${field}_key` || violation.fields.includes(field)
}

/** Whether the error is a foreign key violation (P2003). */
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
}

interface DriverErrorMeta {
  driverAdapterError?: { cause?: { originalCode?: string; constraint?: { index?: string } } }
}

function driverCause(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined
  return (error.meta as DriverErrorMeta | undefined)?.driverAdapterError?.cause
}

/**
 * Whether the error is an exclusion-constraint violation (Postgres 23P01). Prisma has no
 * code of its own for these. Matched by SQLSTATE only, not by message text, which varies
 * with the server's language: callers write to tables with a single exclusion constraint.
 */
export function isExclusionViolation(error: unknown): boolean {
  return driverCause(error)?.originalCode === '23P01'
}

/** The foreign key a write violated (e.g. `bookings_broker_id_user_id_fkey`), if any. */
export function violatedForeignKey(error: unknown): string | undefined {
  if (!isForeignKeyViolation(error)) return undefined
  return driverCause(error)?.constraint?.index
}
