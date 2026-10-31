import { afterAll, beforeEach } from 'vitest'

import { disconnectTestDatabase, resetTestDatabase } from './database.js'

beforeEach(async () => {
  await resetTestDatabase()
})

afterAll(async () => {
  await disconnectTestDatabase()
})
