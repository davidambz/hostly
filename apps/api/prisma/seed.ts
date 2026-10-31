/** `pnpm db:seed`: loads the sample data into DATABASE_URL. */
import { createDatabase } from '../src/shared/database.js'
import { SAMPLE_EMAIL, SAMPLE_PASSWORD, seedSampleData } from './sample-data.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const db = createDatabase(databaseUrl)
try {
  await seedSampleData(db)
  console.info(`Seeded sample data. Log in as ${SAMPLE_EMAIL} / ${SAMPLE_PASSWORD}`)
} finally {
  await db.$disconnect()
}
