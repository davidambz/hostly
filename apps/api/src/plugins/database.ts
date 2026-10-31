import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { createDatabase, type Database } from '../shared/database.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
  }
}

export interface DatabaseOptions {
  url: string
  /** An existing client (e.g. shared by the tests); the app won't disconnect it. */
  client?: Database
}

const database: FastifyPluginAsync<DatabaseOptions> = async (app, { url, client }) => {
  const db = client ?? createDatabase(url)
  app.decorate('db', db)

  if (!client) {
    app.addHook('onClose', async () => {
      await db.$disconnect()
    })
  }
}

export default fp(database, { name: 'database' })
