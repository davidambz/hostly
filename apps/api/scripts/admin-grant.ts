/**
 * `pnpm admin:grant <e-mail>` makes an account an administrator; `--revoke` undoes it.
 * Reads DATABASE_URL like the API. The first admin comes from here; the rest can be named
 * in the backoffice.
 */
import { setAdmin } from '../src/modules/admin/grant-admin.js'
import { createDatabase } from '../src/shared/database.js'

const args = process.argv.slice(2)
const revoke = args.includes('--revoke')
const email = args.find((arg) => !arg.startsWith('--'))
const databaseUrl = process.env.DATABASE_URL

if (!email) {
  console.error('Usage: pnpm admin:grant <e-mail> [--revoke]')
  process.exit(1)
}
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const db = createDatabase(databaseUrl)
try {
  const name = await setAdmin(db, email, !revoke)
  if (name === null) {
    console.error(`No account with the e-mail ${email}`)
    process.exitCode = 1
  } else {
    console.info(
      revoke ? `${name} is no longer an administrator.` : `${name} is now an administrator.`,
    )
  }
} finally {
  await db.$disconnect()
}
