import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router'

import { Providers } from '@/app/providers'
import { createQueryClient } from '@/lib/query-client'

/** Renders `routes` at `path` inside the app's providers, with a fresh query cache. */
export function renderRoute(routes: RouteObject[], path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return {
    router,
    ...render(
      <Providers client={createQueryClient()}>
        <RouterProvider router={router} />
      </Providers>,
    ),
  }
}

/** Renders a single element inside the app's providers. */
export function renderWithProviders(element: ReactElement) {
  return renderRoute([{ path: '*', element }])
}
