import '@/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { Providers } from '@/app/providers'
import { routes } from '@/app/routes'
import { createQueryClient } from '@/lib/query-client'

const root = document.getElementById('root')
if (!root) {
  throw new Error('#root is missing from index.html')
}

createRoot(root).render(
  <StrictMode>
    <Providers client={createQueryClient()}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </Providers>
  </StrictMode>,
)
