import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Brand } from '@/components/brand'
import { ModeToggle } from '@/components/theme/mode-toggle'
import { cn } from '@/lib/utils'

const HIGHLIGHTS = [
  ['Cada imóvel, seu calendário', 'Todas as reservas de cada imóvel, mês a mês.'],
  ['Nada em dobro', 'O Hostly não deixa marcar duas reservas na mesma noite.'],
  ['A conta pronta', 'Total, comissão e o que falta receber, em cada reserva.'],
] as const

/** A sample of January's soundings: a property's nights, its water as deep as it is full. */
const SOUNDINGS = [
  {
    name: 'Apartamento 302',
    nights: 25,
    depth: 'bg-depth-5 text-depth-5-foreground',
    dot: 'bg-property-1',
  },
  {
    name: 'Casa da Praia',
    nights: 19,
    depth: 'bg-depth-4 text-depth-4-foreground',
    dot: 'bg-property-2',
  },
  {
    name: 'Chalé da Lagoa',
    nights: 12,
    depth: 'bg-depth-3 text-depth-3-foreground',
    dot: 'bg-property-3',
  },
] as const

/**
 * Login and signup share this: on large screens, the chart's title block (the top bar's
 * Prussian, a graticule and a sample of soundings) on the left, the form on the right.
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
      <aside className="bg-bar text-bar-foreground chart-graticule relative hidden overflow-hidden p-10 [--contour:rgb(140_205_242/0.07)] lg:flex lg:flex-col lg:justify-between">
        <Link
          to="/"
          className="focus-visible:ring-bar-active self-start rounded-md outline-none focus-visible:ring-2"
        >
          <Brand inverted />
        </Link>
        <div className="animate-surface max-w-md space-y-8">
          <p className="font-wide text-4xl leading-[1.05] font-bold text-balance">
            Cada noite de cada imóvel, no lugar certo.
          </p>
          <figure className="space-y-2">
            <ul className="bg-bar-border grid grid-cols-3 gap-px overflow-hidden rounded-md">
              {SOUNDINGS.map((sounding, index) => (
                <li
                  key={sounding.name}
                  style={{ animationDelay: `${String(200 + index * 90)}ms` }}
                  className={cn('animate-tide flex flex-col gap-3 p-3', sounding.depth)}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                    <span
                      aria-hidden
                      className={cn('size-2 shrink-0 rounded-[2px] ring-2 ring-card', sounding.dot)}
                    />
                    <span className="truncate">{sounding.name}</span>
                  </span>
                  <span className="font-wide text-2xl leading-none font-semibold tabular-nums">
                    {sounding.nights}
                    <span className="font-water ml-1 text-xs font-normal opacity-80">noites</span>
                  </span>
                </li>
              ))}
            </ul>
            <figcaption className="font-water text-bar-muted text-xs">
              Ocupação de janeiro, num exemplo: quanto mais fundo o azul, mais noites reservadas.
            </figcaption>
          </figure>
          <dl className="grid gap-4">
            {HIGHLIGHTS.map(([term, text]) => (
              <div key={term} className="border-bar-border grid gap-0.5 border-t pt-3">
                <dt className="font-semibold">{term}</dt>
                <dd className="text-bar-muted text-sm">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-bar-muted text-xs">© Hostly</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <div className="animate-surface w-full max-w-sm space-y-8">
          <Link
            to="/"
            className="focus-visible:ring-ring inline-flex rounded-sm outline-none focus-visible:ring-2 lg:hidden"
          >
            <Brand />
          </Link>
          <div className="space-y-2">
            <h1 className="font-wide text-4xl leading-tight font-bold">{title}</h1>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
