import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'

import { createDatabase } from '../shared/database.js'
import { fakeDatabase } from '../test/fake-database.js'
import database from './database.js'

vi.mock('../shared/database.js', () => ({ createDatabase: vi.fn() }))

const URL = 'postgresql://hostly:hostly@localhost:5432/hostly_test'

describe('database plugin', () => {
  it('opens its own client from the URL and disconnects it on close', async () => {
    const created = fakeDatabase()
    vi.mocked(createDatabase).mockReturnValue(created)
    const app = Fastify()

    await app.register(database, { url: URL })
    await app.ready()

    expect(createDatabase).toHaveBeenCalledWith(URL)
    expect(app.db).toBe(created)

    await app.close()

    expect(created.$disconnect).toHaveBeenCalledTimes(1)
  })

  it('uses a client it is given and leaves it connected on close', async () => {
    const client = fakeDatabase()
    const app = Fastify()

    await app.register(database, { url: URL, client })
    await app.ready()

    expect(createDatabase).not.toHaveBeenCalled()
    expect(app.db).toBe(client)

    await app.close()

    expect(client.$disconnect).not.toHaveBeenCalled()
  })
})
