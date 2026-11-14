import { Check, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api/form-errors'
import { leaveTo } from '@/lib/navigate'

import { ManageSubscription } from './manage-subscription'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/utils'

import { type MyPlan, type Plan, useCheckout, useMyGrants, useMyPlan, usePlans } from './api'
import {
  grantLabel,
  type PeriodPrice,
  periodPrices,
  sourceLabel,
  subscriptionLabel,
  usageLabel,
} from './plan-labels'

/** The user's plan, the plans there are, and the courtesy plans received. */
/** How often, and how many times, to ask again while Stripe confirms a payment. */
const CONFIRM_POLL_MS = 3000
const CONFIRM_POLLS = 10

export function PlanPage() {
  const myPlan = useMyPlan()
  const [params, setParams] = useSearchParams()
  // Back from Stripe's checkout: the payment is confirmed by a webhook, a moment later.
  const confirming = params.get('assinatura') === 'confirmando'
  const confirmed = myPlan.data?.source === 'SUBSCRIPTION'
  const { refetch } = myPlan

  useEffect(() => {
    if (!confirming) return
    if (confirmed) {
      toast.success('Assinatura confirmada. Bom proveito!')
      setParams({}, { replace: true })
      return
    }
    let polls = 0
    const timer = setInterval(() => {
      polls += 1
      void refetch()
      if (polls >= CONFIRM_POLLS) clearInterval(timer)
    }, CONFIRM_POLL_MS)
    return () => {
      clearInterval(timer)
    }
  }, [confirming, confirmed, refetch, setParams])

  return (
    <>
      <PageHeader title="Meu plano" description="O que o seu plano permite e quanto você usa." />
      {myPlan.isPending ? (
        <LoadingState rows={1} />
      ) : myPlan.isError ? (
        <ErrorState message={errorMessage(myPlan.error)} onRetry={() => void myPlan.refetch()} />
      ) : (
        <div className="grid gap-8">
          {confirming && !confirmed && (
            <p
              role="status"
              className="bg-accent text-accent-foreground flex max-w-2xl items-center gap-2 rounded-md p-3 text-sm"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Pagamento recebido. A Stripe está confirmando; seu plano muda em instantes.
            </p>
          )}
          <CurrentPlan myPlan={myPlan.data} />
          <SubscriptionSection myPlan={myPlan.data} />
          <Plans currentId={myPlan.data.plan.id} paying={myPlan.data.source === 'SUBSCRIPTION'} />
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
        {subscriptionLabel(myPlan) && (
          <p className="text-sm font-medium">{subscriptionLabel(myPlan)}</p>
        )}
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
function Plans({ currentId, paying }: { currentId: string; paying: boolean }) {
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
            <PlanCard key={plan.id} plan={plan} current={plan.id === currentId} paying={paying} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PlanCard({ plan, current, paying }: { plan: Plan; current: boolean; paying: boolean }) {
  const prices = periodPrices(plan)
  const free = plan.code === 'free'
  // Free needs no paying, and a running subscription is changed, not bought twice.
  const buyable = !free && !current && !paying && prices.length > 0
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
      {buyable && <Subscribe plan={plan} prices={prices} />}
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

/** One button per period: each opens Stripe's checkout for it. */
function Subscribe({ plan, prices }: { plan: Plan; prices: PeriodPrice[] }) {
  const checkout = useCheckout()

  const start = async (period: PeriodPrice['period']) => {
    try {
      const { url } = await checkout.mutateAsync({ planId: plan.id, period })
      leaveTo(url)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="grid gap-2 pt-1">
      {prices.map((price) => (
        <Button
          key={price.period}
          variant={price.period === 'MONTHLY' ? 'default' : 'outline'}
          disabled={checkout.isPending}
          onClick={() => void start(price.period)}
        >
          Assinar · {formatBRL(price.price)} {price.label}
        </Button>
      ))}
      <p className="text-muted-foreground text-xs">
        O pagamento é feito na página segura da Stripe.
      </p>
    </div>
  )
}

/** The paid subscription's controls, with its plan's prices for a period change. */
function SubscriptionSection({ myPlan }: { myPlan: MyPlan }) {
  const plans = usePlans()
  if (!myPlan.subscription) return null
  return (
    <ManageSubscription
      myPlan={myPlan}
      plan={plans.data?.find((plan) => plan.id === myPlan.plan.id)}
    />
  )
}
