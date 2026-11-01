import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than the app, so they get their own chunks, which
        // stay cached across deploys; split by family so none of them grows too large.
        // Only dependency-free packages go in 'react', so no chunk imports one that
        // imports it back (react-router, with its own dependencies, stays in vendor).
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 3,
            },
            {
              name: 'radix',
              test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui)[\\/]/,
              priority: 2,
            },
            {
              name: 'forms',
              test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/,
              priority: 2,
            },
            {
              // Only the bookings page uses dates: kept out of what every page loads.
              name: 'dates',
              test: /node_modules[\\/](date-fns|@date-fns|react-day-picker)[\\/]/,
              priority: 2,
            },
            { name: 'vendor', test: /node_modules/, priority: 1 },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    // Room for the first load of a lazy page (see src/test/setup.ts).
    testTimeout: 15_000,
    deps: {
      // Pre-bundled once instead of loaded as hundreds of modules in every worker, which
      // made the first test that opens the bookings page slow.
      optimizer: { client: { enabled: true, include: ['date-fns', 'react-day-picker'] } },
    },
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    restoreMocks: true,
    css: false,
    fsModuleCachePath: fileURLToPath(new URL('node_modules/.vitest-cache', import.meta.url)),
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/lib/api/schema.d.ts',
        'src/components/ui/**',
        'src/vite-env.d.ts',
        'src/lib/browser.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
})
