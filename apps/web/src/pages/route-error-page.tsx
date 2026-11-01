import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { reloadPage } from '@/lib/browser'

/**
 * Shown when a page fails to render or to load (e.g. a chunk missing after a deploy),
 * instead of React Router's developer screen.
 */
export function RouteErrorPage() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="text-destructive size-10" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">
        {notFound ? 'Página não encontrada' : 'Algo deu errado'}
      </h1>
      <p className="text-muted-foreground max-w-sm">
        {notFound
          ? 'O endereço que você abriu não existe ou foi movido.'
          : 'Não foi possível mostrar esta página. Recarregar costuma resolver.'}
      </p>
      <div className="flex gap-2">
        <Button onClick={reloadPage}>Recarregar</Button>
        <Button variant="outline" asChild>
          <Link to="/">Ir para o início</Link>
        </Button>
      </div>
    </main>
  )
}
