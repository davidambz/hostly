import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'
import { reloadPage } from '@/lib/browser'

/**
 * Shown when a page fails to render or to load (e.g. a chunk missing after a deploy),
 * instead of React Router's developer screen. `inline` inside the app layout.
 */
export function RouteErrorPage({ inline = false }: { inline?: boolean }) {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  // Inline: inside the app layout, which keeps its sidebar so the rest of the app still works.
  const Wrapper = inline ? 'section' : 'main'

  return (
    <Wrapper
      className={
        inline
          ? 'flex flex-col items-center justify-center gap-4 py-16 text-center'
          : 'flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center'
      }
    >
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
    </Wrapper>
  )
}
