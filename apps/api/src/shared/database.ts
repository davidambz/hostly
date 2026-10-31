import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'

export type Database = PrismaClient

/** Give up on opening a connection after this long instead of waiting forever. */
export const CONNECTION_TIMEOUT_MS = 5_000
/** Fail a query that gets no answer (e.g. a blackholed connection) after this long. */
export const QUERY_TIMEOUT_MS = 30_000

export function createDatabase(connectionString: string): Database {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  })
  return new PrismaClient({ adapter })
}
