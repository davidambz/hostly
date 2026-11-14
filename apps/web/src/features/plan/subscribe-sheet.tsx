import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Loader2, LockKeyhole } from 'lucide-react'
import { useId, useState } from 'react'

import { ErrorState, LoadingState } from '@/components/states'
import { useTheme } from '@/components/theme/theme-context'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'

import { type BillingPeriod, type Plan, useBillingConfig, useSubscribe } from './api'
import { cardAppearance, cardFonts } from './card-appearance'
import { type PeriodPrice, periodPrices } from './plan-labels'

/** Stripe.js loaded once per key, the first time a card form opens. */
const loaded = new Map<string, Promise<Stripe | null>>()
function stripeFor(key: string) {
  let stripe = loaded.get(key)
  if (!stripe) {
    stripe = loadStripe(key)
    loaded.set(key, stripe)
  }
  return stripe
}

/**
 * Subscribing without leaving the app: the plan's periods to pick from and Stripe's card
 * fields, dressed as the app's own. The card goes straight to Stripe; the subscription is
 * only created when the user pays, and the webhook switches the plan on.
 */
export function SubscribeSheet({
  plan,
  period,
  onPeriodChange,
  open,
  onOpenChange,
  onPaid,
}: {
  plan: Plan
  period: BillingPeriod
  onPeriodChange: (period: BillingPeriod) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}) {
  const config = useBillingConfig(open)
  const { resolvedTheme } = useTheme()
  const prices = periodPrices(plan)
  const price = prices.find((item) => item.period === period) ?? prices[0]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Assinar o {plan.name}</SheetTitle>
          <SheetDescription>
            {plan.description ?? 'Escolha a periodicidade e pague com o cartão.'}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-6">
          {prices.length > 1 && (
            <PeriodChoice prices={prices} period={period} onChange={onPeriodChange} />
          )}
          {!price ? null : config.isPending ? (
            <LoadingState rows={2} />
          ) : config.isError ? (
            <ErrorState
              message={errorMessage(config.error)}
              onRetry={() => void config.refetch()}
            />
          ) : (
            <Elements
              // A new amount is a new payment: the fields start over.
              key={`${price.period}-${resolvedTheme}`}
              stripe={stripeFor(config.data.publishableKey)}
              options={{
                mode: 'subscription',
                amount: price.price,
                currency: 'brl',
                locale: 'pt-BR',
                appearance: cardAppearance(resolvedTheme === 'dark'),
                fonts: cardFonts(),
              }}
            >
              <CardForm plan={plan} price={price} onPaid={onPaid} />
            </Elements>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PeriodChoice({
  prices,
  period,
  onChange,
}: {
  prices: PeriodPrice[]
  period: BillingPeriod
  onChange: (period: BillingPeriod) => void
}) {
  const id = useId()
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Periodicidade</legend>
      <RadioGroup
        value={period}
        onValueChange={(value) => {
          const chosen = prices.find((item) => item.period === value)
          if (chosen) onChange(chosen.period)
        }}
        className="grid gap-2"
      >
        {prices.map((item) => (
          <Label
            key={item.period}
            htmlFor={`${id}-${item.period}`}
            className="has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-accent flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal"
          >
            <RadioGroupItem id={`${id}-${item.period}`} value={item.period} />
            <span className="font-wide text-base font-semibold tabular-nums">
              {formatBRL(item.price)}
            </span>
            <span className="font-water text-muted-foreground text-sm">{item.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

/** The card fields and the pay button: Stripe charges the card, the API never sees it. */
function CardForm({ plan, price, onPaid }: { plan: Plan; price: PeriodPrice; onPaid: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const subscribe = useSubscribe()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const pay = async () => {
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)
    try {
      // The card's own checks first (number, date, code), before any subscription exists.
      const checked = await elements.submit()
      if (checked.error) {
        setError(checked.error.message ?? 'Confira os dados do cartão.')
        return
      }
      const { clientSecret } = await subscribe.mutateAsync({
        planId: plan.id,
        period: price.period,
      })
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        // Only when the bank's check (3D Secure) needs a page of its own.
        confirmParams: {
          return_url: `${window.location.origin}/plano?assinatura=confirmando`,
        },
        redirect: 'if_required',
      })
      if (result.error) {
        setError(result.error.message ?? 'O pagamento não foi aprovado.')
        return
      }
      onPaid()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPaying(false)
    }
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void pay()
      }}
    >
      <PaymentElement
        options={{ layout: 'tabs' }}
        onReady={() => {
          setReady(true)
        }}
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!stripe || !ready || paying}>
        {paying && <Loader2 className="animate-spin" aria-hidden />}
        Pagar {formatBRL(price.price)} {price.label}
      </Button>
      <p className="text-muted-foreground flex items-start gap-2 text-xs text-pretty">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Os dados do cartão vão direto para a Stripe, que processa o pagamento; o Hostly não os vê
        nem guarda. A renovação é automática, e você pode cancelá-la quando quiser.
      </p>
    </form>
  )
}
