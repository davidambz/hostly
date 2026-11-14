import { Check } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/utils'

import { type MyPlan, type Plan, useMyGrants, useMyPlan, usePlans } from './api'
import { grantLabel, periodPrices, sourceLabel, usageLabel } from './plan-labels'

/** The user's plan, the plans there are, and the courtesy plans received. */
export function PlanPage() {
  const myPlan = useMyPlan()

  return (
    <>
      <PageHeader title="Meu plano" description="O que o seu plano permite e quanto você usa." />
      {myPlan.isPending ? (
        <LoadingState rows={1} />
      ) : myPlan.isError ? (
        <ErrorState message={errorMessage(myPlan.error)} onRetry={() => void myPlan.refetch()} />
      ) : (
        <div className="grid gap-8">
          <CurrentPlan myPlan={myPlan.data} />
          <Plans currentId={myPlan.data.plan.id} />
          <Grants />
        </div>
      )}
    </>
  )
}

function CurrentPlan({ myPlan }: { myPlan: MyPlan }) {
  return (
    <section
      aria-labelledby="my-plan-title"
      className="bg-card grid max-w-2xl gap-4 rounded-md border p-5"
    >
      <div className="grid gap-1">
        <h2 id="my-plan-title" className="font-wide text-2xl font-bold">
          {myPlan.plan.name}
        </h2>
        {myPlan.plan.description && (
          <p className="text-muted-foreground">{myPlan.plan.description}</p>
        )}
        {sourceLabel(myPlan) && <p className="text-sm font-medium">{sourceLabel(myPlan)}</p>}
      </div>
      <dl className="grid gap-1">
        <dt className="text-muted-foreground text-sm">Imóveis</dt>
        <dd className="font-wide text-xl font-semibold tabular-nums">{usageLabel(myPlan)}</dd>
      </dl>
      {!myPlan.canAddProperty && (
        <p className="text-sm">
          Você chegou ao limite do seu plano. Seus imóveis continuam todos aqui; para cadastrar
          mais, é preciso o Premium.
        </p>
      )}
    </section>
  )
}

/** The plans on sale, side by side, the user's own marked. */
function Plans({ currentId }: { currentId: string }) {
  const plans = usePlans()
  return (
    <section aria-labelledby="plans-title" className="grid gap-3">
      <h2 id="plans-title" className="font-wide text-xl font-semibold">
        Planos
      </h2>
      {plans.isPending ? (
        <LoadingState rows={2} />
      ) : plans.isError ? (
        <ErrorState message={errorMessage(plans.error)} onRetry={() => void plans.refetch()} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.data.map((plan) => (
            <PlanCard key={plan.id} plan={plan} current={plan.id === currentId} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PlanCard({ plan, current }: { plan: Plan; current: boolean }) {
  const prices = periodPrices(plan)
  const free = plan.code === 'free'
  return (
    <li
      aria-label={plan.name}
      className={cn(
        'bg-card grid content-start gap-3 rounded-md border p-5',
        current && 'ring-primary ring-2',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-wide text-lg font-bold">{plan.name}</h3>
        {current && <Badge>Seu plano</Badge>}
      </div>
      {plan.description && <p className="text-muted-foreground text-sm">{plan.description}</p>}
      <p className="flex items-center gap-2 text-sm">
        <Check className="text-primary size-4" aria-hidden />
        {plan.maxProperties === null
          ? 'Imóveis ilimitados'
          : plan.maxProperties === 1
            ? '1 imóvel'
            : `Até ${String(plan.maxProperties)} imóveis`}
      </p>
      {free ? (
        <p className="font-wide text-xl font-semibold">De graça</p>
      ) : prices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Preços em breve.</p>
      ) : (
        <ul className="grid gap-0.5">
          {prices.map((period) => (
            <li key={period.label} className="tabular-nums">
              <span className="font-wide text-lg font-semibold">{formatBRL(period.price)}</span>{' '}
              <span className="text-muted-foreground text-sm">{period.label}</span>
            </li>
          ))}
        </ul>
      )}
      {!free && !current && (
        <p className="text-muted-foreground text-sm">A contratação pelo Hostly chega em breve.</p>
      )}
    </li>
  )
}

/** The courtesy plans received, if any. */
function Grants() {
  const grants = useMyGrants()
  if (!grants.data || grants.data.length === 0) return null
  return (
    <section aria-labelledby="grants-title" className="grid max-w-2xl gap-3">
      <h2 id="grants-title" className="font-wide text-xl font-semibold">
        Cortesias
      </h2>
      <ul className="divide-y rounded-md border">
        {grants.data.map((grant) => (
          <li
            key={grant.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
          >
            <span>{grantLabel(grant)}</span>
            {grant.inForce ? (
              <Badge>Em vigor</Badge>
            ) : grant.revokedAt ? (
              <Badge variant="outline">Encerrada</Badge>
            ) : (
              <Badge variant="outline">Terminou</Badge>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
