/**
 * Writes the API's OpenAPI document to openapi.json, the contract the web app generates
 * its types from. No database or secrets needed: the app is built but never listens or
 * runs a query. CI fails if the committed file is out of date.
 */
import { writeFile } from 'node:fs/promises'

import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/config/env.js'

const app = await buildApp(
  loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DOCS_ENABLED: 'true',
    DATABASE_URL: 'postgresql://openapi:openapi@localhost:1/openapi',
    JWT_SECRET: 'only-used-to-build-the-app-for-the-openapi-export',
  }),
)
await app.ready()
const document = app.swagger()
await writeFile(
  new URL('../openapi.json', import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
)
await app.close()
