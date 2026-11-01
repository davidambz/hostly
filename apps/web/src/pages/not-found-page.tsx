import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-primary text-sm font-medium">Erro 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-sm">
        O endereço que você abriu não existe ou foi movido.
      </p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </main>
  )
}
