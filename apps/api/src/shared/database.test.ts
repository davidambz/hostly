import { describe, expect, it } from 'vitest'

import { createDatabase } from './database.js'

describe('createDatabase', () => {
  it('builds a Prisma client with every model, without connecting yet', async () => {
    // Port 1 never answers: any eager connection attempt would fail this test.
    const db = createDatabase('postgresql://hostly:hostly@localhost:1/never_used')

    expect(typeof db.$queryRaw).toBe('function')
    for (const model of [db.user, db.property, db.broker, db.booking]) {
      expect(typeof model.findMany).toBe('function')
    }
    await expect(db.$disconnect()).resolves.toBeUndefined()
  })
})
