import { execFileSync } from 'node:child_process'

import pg from 'pg'

import { testDatabaseUrl } from './database-url.js'

/** Recreates the test database from scratch and applies every migration. */
export default async function setup() {
  const url = testDatabaseUrl()
  const name = url.pathname.slice(1)

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    await admin.query(`CREATE DATABASE "${name}"`)
  } finally {
    await admin.end()
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  })
}
