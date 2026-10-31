import { createDatabase, type Database } from '../../shared/database.js'
import { testDatabaseUrl } from './database-url.js'

let db: Database | undefined

/** One client per test file, connected to the migrated test database. */
export function testDatabase(): Database {
  db ??= createDatabase(testDatabaseUrl().toString())
  return db
}

export async function disconnectTestDatabase() {
  await db?.$disconnect()
  db = undefined
}

/** Empties every table (keeping the migrations history) so each test starts clean. */
export async function resetTestDatabase() {
  const database = testDatabase()
  const tables = await database.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `
  if (tables.length === 0) return
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ')
  await database.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
}
