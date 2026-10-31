import { Prisma } from '../generated/prisma/client.js'

interface DriverAdapterMeta {
  driverAdapterError?: { cause?: { constraint?: { index?: string } } }
}

/**
 * The name of the unique constraint a write violated (e.g. `users_email_key`), or
 * undefined when the error is anything else.
 */
export function violatedUniqueConstraint(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined
  }
  const meta = error.meta as DriverAdapterMeta | undefined
  return meta?.driverAdapterError?.cause?.constraint?.index
}
