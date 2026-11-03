import { Loader2, WifiOff } from 'lucide-react'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'

import { useAuth } from './auth-context'
import { APP_HOME, safeRedirect } from './redirect'

function FullScreenSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

function Unavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <WifiOff className="text-muted-foreground size-10" aria-hidden />
      <h1 className="text-xl font-semibold">Não foi possível conectar</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        O servidor não respondeu. Sua sessão continua guardada; tente de novo em instantes.
      </p>
      <Button onClick={onRetry}>Tentar de novo</Button>
    </main>
  )
}

/** Pages for logged-in users; anyone else goes to the login, coming back here after it. */
export function RequireAuth() {
  const { status, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'unavailable') return <Unavailable onRetry={retry} />
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

/**
 * The public home page: shown at once, without waiting for the session to resume, and left
 * for the app as soon as it turns out the visitor is logged in. If the API can't be reached,
 * a notice offers to try again, since the visitor may well have a session.
 */
export function RequireVisitor() {
  const { status, retry } = useAuth()

  if (status === 'authenticated') return <Navigate to={APP_HOME} replace />
  return (
    <>
      {status === 'unavailable' && (
        <div
          role="status"
          className="bg-muted text-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm"
        >
          <WifiOff className="text-muted-foreground size-4" aria-hidden />
          Não foi possível conectar ao servidor. Se você já entrou antes, sua sessão continua
          guardada.
          <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>
            Tentar de novo
          </Button>
        </div>
      )}
      <Outlet />
    </>
  )
}
