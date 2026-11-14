import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Brand } from '@/components/brand'
import { ModeToggle } from '@/components/theme/mode-toggle'

const HIGHLIGHTS = [
  ['Uma noite, um ladrilho', 'Todas as reservas de cada imóvel num calendário.'],
  ['Nada em dobro', 'O Hostly não deixa marcar duas reservas na mesma noite.'],
  ['A conta pronta', 'Total, comissão e o que falta receber, em cada reserva.'],
] as const

/**
 * Login and signup share this: a wall of night tiles with the brand painted on a white tile
 * (large screens), the form on the right.
 */
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
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="azulejo-field bg-sidebar relative hidden overflow-hidden p-10 [--tile-ink:var(--sidebar-accent)] [--tile-size:72px] [--card:var(--sidebar)] [--grout:var(--sidebar-border)] lg:flex lg:flex-col lg:justify-between">
        <Link
          to="/"
          className="bg-background text-foreground focus-visible:ring-ring self-start rounded-md px-3 py-2 outline-none [--card:var(--popover)] focus-visible:ring-2"
        >
          <Brand />
        </Link>
        <div className="bg-background text-foreground animate-tile-flip max-w-md rounded-md p-8 shadow-[0_30px_60px_-24px_var(--frame-shadow)]">
          <p className="font-display text-4xl leading-[1.05] tracking-tight text-balance">
            Sua temporada, ladrilho por ladrilho.
          </p>
          <dl className="mt-8 grid gap-4">
            {HIGHLIGHTS.map(([term, text], index) => (
              <div
                key={term}
                style={{ animationDelay: `${String(150 + index * 120)}ms` }}
                className="animate-tile-settle grid grid-cols-[auto_1fr] gap-x-3"
              >
                <span
                  aria-hidden
                  className={`row-span-2 mt-1 size-3 rounded-[2px] ${
                    ['bg-property-1', 'bg-property-2', 'bg-property-3'][index] ?? ''
                  }`}
                />
                <dt className="font-semibold">{term}</dt>
                <dd className="text-muted-foreground text-sm">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-sidebar-foreground/70 text-xs">© Hostly</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <div className="animate-tile-flip w-full max-w-sm space-y-8">
          <Link
            to="/"
            className="focus-visible:ring-ring inline-flex rounded-sm outline-none focus-visible:ring-2 lg:hidden"
          >
            <Brand />
          </Link>
          <div className="space-y-2">
            <h1 className="font-display text-4xl leading-tight tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
