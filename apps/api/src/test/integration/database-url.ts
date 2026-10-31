export const DEFAULT_TEST_DATABASE_URL = 'postgresql://hostly:hostly@localhost:5432/hostly_test'

/** The database name in a connection URL, decoded the way pg and Prisma read it. */
export function databaseName(url: URL): string {
  return decodeURIComponent(url.pathname.slice(1))
}

/**
 * The integration tests drop and recreate this database on every run, so it must be a
 * throwaway one: its name has to end in `_test`.
 */
export function testDatabaseUrl(): URL {
  // Empty counts as unset, like every key in .env.example.
  const fromEnv = process.env.TEST_DATABASE_URL
  const raw = fromEnv === undefined || fromEnv === '' ? DEFAULT_TEST_DATABASE_URL : fromEnv
  const url = new URL(raw)
  const name = databaseName(url)
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to use "${name}" as the test database: its name must end in "_test" ` +
        'because the integration tests drop and recreate it.',
    )
  }
  return url
}
