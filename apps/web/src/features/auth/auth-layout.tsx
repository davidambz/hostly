import { CalendarDays, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { ModeToggle } from '@/components/theme/mode-toggle'

const HIGHLIGHTS = [
  'Todas as reservas de cada imóvel num calendário',
  'Sem datas sobrepostas: o sistema não deixa',
  'Quanto receber, quanto já entrou e a comissão de cada intermediador',
]

/** Login and signup share this: the brand on the left (large screens), the form on the right. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="bg-sidebar text-sidebar-foreground hidden flex-col justify-between p-10 lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          Hostly
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl leading-tight font-semibold">
            Suas reservas de temporada,
            <br />
            organizadas.
          </h2>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((text) => (
              <li key={text} className="flex items-start gap-3 text-sm opacity-90">
                <CheckCircle2 className="text-sidebar-primary mt-0.5 size-4 shrink-0" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs opacity-60">© Hostly</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 text-lg font-semibold lg:hidden">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            Hostly
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
