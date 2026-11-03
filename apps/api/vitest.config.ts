import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Workspace packages straight from their source, so an edit there shows up without a build.
// The rest are Vite's defaults for the server (`defaultServerConditions`).
const conditions = ['@hostly/source', 'module', 'node', 'development|production']

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: conditions } },
  test: {
    // Inside the app instead of the workspace root's node_modules, which the dev
    // container's node user can't write to.
    fsModuleCachePath: fileURLToPath(new URL('node_modules/.vitest-cache', import.meta.url)),
    clearMocks: true,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
          exclude: ['**/*.int.test.ts'],
        },
      },
      {
        // Against a real Postgres (TEST_DATABASE_URL), recreated and migrated on each
        // run and emptied before each test. Files run one at a time since they share it.
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts', 'prisma/**/*.int.test.ts'],
          globalSetup: ['src/test/integration/global-setup.ts'],
          setupFiles: ['src/test/integration/setup.ts'],
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/server.ts', 'src/generated/**'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
})
