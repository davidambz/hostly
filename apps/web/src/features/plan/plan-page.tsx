import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api/form-errors'
import { leaveTo } from '@/lib/navigate'

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
import { ManageSubscription } from './manage-subscription'

/** How often, and how many times, to ask again while Stripe confirms a payment. */
const CONFIRM_POLL_MS = 3000
const CONFIRM_POLLS = 10

/** The user's plan, the subscription, the plans there are, and the courtesy plans received. */
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
              className="bg-accent text-accent-foreground flex items-center gap-2 rounded-md p-3 text-sm"
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

/** The current plan as a band of figures: the plan, the properties it allows, how it is paid. */
function CurrentPlan({ myPlan }: { myPlan: MyPlan }) {
  const plans = usePlans()
  const plan = plans.data?.find((item) => item.id === myPlan.plan.id)
  const price =
    myPlan.subscription && plan
      ? periodPrices(plan).find((item) => item.period === myPlan.subscription?.period)
      : undefined
  const limit = myPlan.plan.maxProperties
  const used = limit === null ? null : Math.min(1, myPlan.propertyCount / limit)
  const billing =
    subscriptionLabel(myPlan) ??
    sourceLabel(myPlan) ??
    (myPlan.plan.code === 'free' ? 'Sem cobrança e sem prazo.' : null)

  return (
    <section aria-labelledby="my-plan-title" className="grid gap-3">
      <div className="bg-grid-line grid gap-px overflow-hidden rounded-md border sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="bg-card grid content-start gap-1 p-5">
          <p className="text-muted-foreground text-sm">Seu plano</p>
          <h2 id="my-plan-title" className="font-wide text-3xl leading-tight font-bold">
            {myPlan.plan.name}
          </h2>
          {myPlan.plan.description && (
            <p className="text-muted-foreground text-sm text-pretty">{myPlan.plan.description}</p>
          )}
        </div>
        <div className="bg-card grid content-start gap-2 p-5">
          <p className="text-muted-foreground text-sm">Imóveis</p>
          <p className="font-wide text-xl leading-tight font-semibold tabular-nums">
            {usageLabel(myPlan)}
          </p>
          {used !== null && (
            <span
              className="bg-muted block h-1.5 overflow-hidden rounded-full"
              role="meter"
              aria-label="Imóveis usados"
              aria-valuemin={0}
              aria-valuemax={limit ?? 0}
              aria-valuenow={Math.min(myPlan.propertyCount, limit ?? 0)}
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  myPlan.canAddProperty ? 'bg-primary' : 'bg-warning',
                )}
                style={{ width: `${String(used * 100)}%` }}
              />
            </span>
          )}
        </div>
        <div className="bg-card grid content-start gap-1 p-5 sm:col-span-2 lg:col-span-1">
          <p className="text-muted-foreground text-sm">Cobrança</p>
          <p className="font-wide text-xl leading-tight font-semibold tabular-nums">
            {price ? `${formatBRL(price.price)} ${price.label}` : 'De graça'}
          </p>
          {billing && <p className="text-sm text-pretty">{billing}</p>}
        </div>
      </div>
      {!myPlan.canAddProperty && (
        <p className="bg-sand text-sand-foreground flex items-start gap-2 rounded-md p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Você chegou ao limite do seu plano. Seus imóveis continuam todos aqui; para cadastrar
            mais, é preciso o Premium.
          </span>
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
        <ul
          className={cn(
            'bg-grid-line grid gap-px overflow-hidden rounded-md border sm:grid-cols-2',
            plans.data.length > 2 && 'lg:grid-cols-3',
          )}
        >
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
    <li aria-label={plan.name} className="bg-card flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-wide text-2xl font-bold">{plan.name}</h3>
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
        <p className="font-wide text-2xl font-semibold">De graça</p>
      ) : prices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Preços em breve.</p>
      ) : (
        <ul className="grid gap-0.5">
          {prices.map((period) => (
            <li key={period.label} className="tabular-nums">
              <span className="font-wide text-2xl font-semibold">{formatBRL(period.price)}</span>{' '}
              <span className="font-water text-muted-foreground text-sm">{period.label}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Pushed to the bottom, so the plans' actions line up whatever their text. */}
      {buyable && (
        <div className="mt-auto pt-2">
          <Subscribe plan={plan} prices={prices} />
        </div>
      )}
    </li>
  )
}

/** The courtesy plans received, if any. */
function Grants() {
  const grants = useMyGrants()
  if (!grants.data || grants.data.length === 0) return null
  return (
    <section aria-labelledby="grants-title" className="grid gap-3">
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
    <div className="grid gap-2">
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
