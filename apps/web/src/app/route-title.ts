import { useEffect } from 'react'
import { useMatches } from 'react-router'

import { isRouteHandle } from './navigation'

/** The title of the deepest route that has one (`handle.title`). */
export function useRouteTitle(): string | undefined {
  const match = useMatches().findLast((m) => isRouteHandle(m.handle))
  return isRouteHandle(match?.handle) ? match.handle.title : undefined
}

/** Keeps the browser tab's title in step with the current route, on every page. */
export function useDocumentTitle() {
  const title = useRouteTitle()
  useEffect(() => {
    document.title = title ? `${title} · Hostly` : 'Hostly'
  }, [title])
}
