import closeWithGrace from 'close-with-grace'

import { buildApp } from './app.js'
import { loadEnv } from './config/env.js'

const env = loadEnv()
const app = await buildApp(env)

closeWithGrace({ delay: 10_000 }, async ({ signal, err }) => {
  if (err) {
    app.log.error({ err }, 'shutting down after an error')
  } else {
    app.log.info({ signal }, 'shutting down')
  }
  await app.close()
})

try {
  await app.listen({ host: env.HOST, port: env.PORT })
} catch (err) {
  app.log.fatal({ err }, 'failed to start the server')
  await app.close()
  process.exit(1)
}
