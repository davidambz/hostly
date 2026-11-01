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
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
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
