import { CalendarDays } from 'lucide-react'

import { ModeToggle } from '@/components/theme/mode-toggle'

/** Placeholder until the authenticated layout (#15) takes over the root route. */
export function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-xl">
        <CalendarDays className="size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Hostly</h1>
        <p className="text-muted-foreground">Gestão de reservas para aluguel de temporada.</p>
      </div>
    </main>
  )
}
