import { Loader2 } from 'lucide-react'
import { Outlet } from 'react-router'

import { useDocumentTitle } from './route-title'

/** Wraps every route: keeps the tab title in sync with the page. */
export function RootLayout() {
  useDocumentTitle()
  return <Outlet />
}

/** Shown while the first page's code downloads, before anything else can render. */
export function AppLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
