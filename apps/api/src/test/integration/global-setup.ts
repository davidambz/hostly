import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { databaseName, testDatabaseUrl } from './database-url.js'

/** apps/api, where prisma.config.ts lives, whatever directory vitest was started from. */
const API_ROOT = fileURLToPath(new URL('../../..', import.meta.url))

/** Recreates the test database from scratch and applies every migration. */
export default async function setup() {
  const url = testDatabaseUrl()
  const name = pg.escapeIdentifier(databaseName(url))

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await admin.query(`CREATE DATABASE ${name}`)
  } finally {
    await admin.end()
  }

  try {
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
    })
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer }
    throw new Error(
      `Migrating the test database failed:\n${String(stdout ?? '')}${String(stderr ?? '')}`,
      { cause: error },
    )
  }
}
