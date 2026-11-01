import type { RouteObject } from 'react-router'

import { routes } from '@/app/routes'

async function preload(list: RouteObject[]): Promise<void> {
  await Promise.all(
    list.map(async (route) => {
      if (typeof route.lazy === 'function') await route.lazy()
      if (route.children) await preload(route.children)
    }),
  )
}

// The pages are lazy-loaded. Loading every one of them here, once per test file that renders
// the app's routes, keeps that cost (slow under coverage on CI) out of the tests' timeouts.
await preload(routes)

/** The app's routes, with every lazy page already loaded. */
export { routes }
