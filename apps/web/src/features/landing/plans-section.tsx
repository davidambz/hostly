import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { type Plan, usePlans } from '@/features/plan/api'
import { periodPrices } from '@/features/plan/plan-labels'
import { formatBRL } from '@/lib/money'

const limitLabel = (plan: Plan) =>
  plan.maxProperties === null
    ? 'Imóveis sem limite'
    : plan.maxProperties === 1
      ? '1 imóvel'
      : `Até ${String(plan.maxProperties)} imóveis`

/**
 * The plans on sale with their real prices, read from the API (they are set in the
 * backoffice). Without an answer, the plans' names still show, with no made-up price.
 */
export function PlansSection({ signup }: { signup: string }) {
  const plans = usePlans()
  const list = plans.data ?? []

  return (
    <section
      aria-labelledby="plans-title"
      className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12"
    >
      <div className="lg:col-span-4">
        <h2
          id="plans-title"
          className="font-wide text-3xl leading-tight font-bold text-balance sm:text-4xl"
        >
          Comece de graça, cresça quando precisar
        </h2>
        <p className="text-muted-foreground mt-4 text-pretty">
          O Free cuida de um imóvel sem prazo e sem cartão. Quando a temporada pedir mais imóveis, o
          Premium libera todos, e você cancela a renovação quando quiser.
        </p>
      </div>
      <div className="min-w-0 lg:col-span-8">
        {plans.isPending ? (
          <div
            className="bg-card h-56 animate-pulse rounded-md border"
            aria-label="Carregando planos"
          />
        ) : list.length === 0 ? (
          <p className="text-muted-foreground">
            Os planos aparecem aqui assim que estiverem no ar.{' '}
            <Link
              to={signup}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Crie a conta
            </Link>{' '}
            e comece pelo Free.
          </p>
        ) : (
          <ul
            aria-label="Planos"
            className="bg-grid-line grid gap-px overflow-hidden rounded-md border sm:grid-cols-2"
          >
            {list.map((plan) => {
              const prices = periodPrices(plan)
              return (
                <li
                  key={plan.id}
                  aria-label={plan.name}
                  className="bg-card grid content-start gap-4 p-6"
                >
                  <div className="grid gap-1">
                    <h3 className="font-wide text-2xl font-semibold">{plan.name}</h3>
                    <p className="text-sm font-medium">{limitLabel(plan)}</p>
                    {plan.description && (
                      <p className="text-muted-foreground text-sm text-pretty">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  {prices.length === 0 ? (
                    <p className="font-wide text-3xl font-semibold">De graça</p>
                  ) : (
                    <dl className="grid gap-1.5">
                      {prices.map((price) => (
                        <div key={price.period} className="flex items-baseline gap-2">
                          <dt className="sr-only">{price.label}</dt>
                          <dd className="font-wide text-2xl font-semibold tabular-nums">
                            {formatBRL(price.price)}
                          </dd>
                          <span className="font-water text-muted-foreground text-sm" aria-hidden>
                            {price.label}
                          </span>
                        </div>
                      ))}
                    </dl>
                  )}
                  <Button
                    asChild
                    variant={prices.length === 0 ? 'default' : 'outline'}
                    className="w-fit"
                  >
                    <Link to={signup}>
                      {prices.length === 0 ? 'Criar conta grátis' : 'Criar conta e assinar'}
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
