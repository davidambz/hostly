import { Check } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { readStored, writeStored } from '@/lib/local-store'
import { cn } from '@/lib/utils'

import { useBookings } from './api'

export const FIRST_STEPS_HIDDEN_KEY = 'hostly-first-steps-hidden'

/**
 * Guides a new account to its first booking: register a property, then book it, with the
 * broker as an optional extra. Shows while the account has no booking yet, until the user
 * hides it; disappears for good once the first booking exists. `fallback` shows instead
 * whenever the steps don't.
 */
export function FirstSteps({
  hasProperty,
  onNewBooking,
  fallback = null,
}: {
  hasProperty: boolean
  onNewBooking: () => void
  fallback?: ReactNode
}) {
  const [hidden, setHidden] = useState(() => readStored(FIRST_STEPS_HIDDEN_KEY) === '1')
  const upcoming = useBookings({ status: 'upcoming', page: 1 })
  const past = useBookings({ status: 'past', page: 1 })

  if (hidden || !upcoming.isSuccess || !past.isSuccess) return fallback
  if (upcoming.data.total + past.data.total > 0) return fallback

  const steps = [
    {
      title: 'Cadastre o primeiro imóvel',
      description: 'A casa ou o apartamento que você aluga, com o endereço pelo CEP.',
      done: hasProperty,
      action: (
        <Button asChild size="sm" variant={hasProperty ? 'outline' : 'default'}>
          <Link to="/imoveis">Ir para imóveis</Link>
        </Button>
      ),
    },
    {
      title: 'Lance a primeira reserva',
      description:
        'Escolha o imóvel, as datas e a diária: o resumo mostra o total, a comissão e o que falta receber.',
      done: false,
      action: hasProperty ? (
        <Button size="sm" onClick={onNewBooking}>
          Nova reserva
        </Button>
      ) : null,
    },
    {
      title: 'Cadastre quem traz reservas',
      description:
        'Se um corretor ou uma imobiliária traz hóspedes, cadastre com a comissão: ela entra em cada reserva. É opcional.',
      done: false,
      action: (
        <Button asChild size="sm" variant="outline">
          <Link to="/intermediadores">Ir para intermediadores</Link>
        </Button>
      ),
    },
  ]

  return (
    <section
      aria-labelledby="first-steps-title"
      className="bg-card animate-surface rounded-md border"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="first-steps-title" className="font-wide text-lg font-semibold">
          Primeiros passos
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            writeStored(FIRST_STEPS_HIDDEN_KEY, '1')
            setHidden(true)
          }}
        >
          Esconder
        </Button>
      </div>
      <ol className="divide-y">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center"
          >
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                step.done && 'bg-primary text-primary-foreground border-primary',
              )}
            >
              {step.done ? <Check className="size-4" aria-label="Feito" /> : index + 1}
            </span>
            <div className="grid gap-0.5">
              <p className={cn('font-medium', step.done && 'text-muted-foreground line-through')}>
                {step.title}
              </p>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </div>
            {step.action && !step.done && (
              <div className="col-start-2 sm:col-start-auto">{step.action}</div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
