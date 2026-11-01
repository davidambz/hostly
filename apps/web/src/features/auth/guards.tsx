import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'

import { useAuth } from './auth-context'
import { safeRedirect } from './redirect'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

/** Pages for logged-in users; anyone else goes to the login, coming back here after it. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'anonymous') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}

/** Login and signup: a logged-in user has no business there and goes on to the app. */
export function RequireGuest() {
  const { status } = useAuth()
  const [params] = useSearchParams()

  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'authenticated')
    return <Navigate to={safeRedirect(params.get('redirect'))} replace />
  return <Outlet />
}
