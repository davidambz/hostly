import { CalendarDays, LogOut } from 'lucide-react'

import { ModeToggle } from '@/components/theme/mode-toggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'

/** Placeholder until the authenticated layout (#15) takes over the root route. */
export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <ModeToggle />
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => void logout()}>
          <LogOut className="size-5" />
        </Button>
      </div>
      <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-xl">
        <CalendarDays className="size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {user?.name.split(' ')[0]}</h1>
        <p className="text-muted-foreground">Gestão de reservas para aluguel de temporada.</p>
      </div>
    </main>
  )
}
