import { format } from 'date-fns'
import { CreditCard, Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'

import {
  type BillingPeriod,
  type MyPlan,
  type Plan,
  useBillingPayments,
  useChangePeriod,
  usePeriodPreview,
  useSavedCard,
  useSetRenewal,
} from './api'
import { CardSheet } from './card-sheet'
import { cardLabel, periodPrices } from './plan-labels'

const PERIOD_NAMES: Record<BillingPeriod, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
}

/**
 * The paid subscription, as the user runs it: the renewal, the billing period, the card
 * (in Stripe's portal) and every charge.
 */
export function ManageSubscription({ myPlan, plan }: { myPlan: MyPlan; plan?: Plan }) {
  const subscription = myPlan.subscription
  if (!subscription) return null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section
        aria-labelledby="subscription-title"
        className="bg-card grid content-start gap-5 rounded-md border p-5"
      >
        <h2 id="subscription-title" className="font-wide text-xl font-semibold">
          Sua assinatura
        </h2>
        <Renewal cancelled={subscription.cancelAtPeriodEnd} end={subscription.currentPeriodEnd} />
        {plan && !subscription.cancelAtPeriodEnd && (
          <PeriodChange plan={plan} current={subscription.period} />
        )}
        <Card />
      </section>
      <Payments />
    </div>
  )
}

function Renewal({ cancelled, end }: { cancelled: boolean; end: string | null }) {
  const setRenewal = useSetRenewal()
  const [confirming, setConfirming] = useState(false)
  const day = end ? format(new Date(end), 'dd/MM/yyyy') : ''

  const change = async (renew: boolean) => {
    try {
      await setRenewal.mutateAsync(renew)
      toast.success(renew ? 'Renovação retomada.' : `Renovação cancelada. O plano vale até ${day}.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Renovação</h3>
      {cancelled ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Cancelada: o plano vale até {day}.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={setRenewal.isPending}
            onClick={() => void change(true)}
          >
            Retomar renovação
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Automática{day && `, próxima cobrança em ${day}`}.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setConfirming(true)
            }}
          >
            Cancelar renovação
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cancelar a renovação?"
        description={`Você não será mais cobrado. O plano continua até ${day}, e depois a conta volta ao Free sem perder nenhum imóvel.`}
        confirmLabel="Cancelar renovação"
        pending={setRenewal.isPending}
        onConfirm={() => void change(false)}
      />
    </div>
  )
}

function PeriodChange({ plan, current }: { plan: Plan; current: BillingPeriod }) {
  const changePeriod = useChangePeriod()
  const options = periodPrices(plan).filter((price) => price.period !== current)
  const [period, setPeriod] = useState<BillingPeriod | ''>('')
  const id = useId()

  const preview = usePeriodPreview()
  const [due, setDue] = useState<number | null>(null)
  const chosen = options.find((option) => option.period === period)

  // First what it would charge now, from Stripe; the change only after the user confirms.
  const ask = async () => {
    if (!period) return
    try {
      setDue((await preview.mutateAsync(period)).amountDue)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const change = async () => {
    if (!period) return
    try {
      await changePeriod.mutateAsync(period)
      toast.success(`Assinatura ${PERIOD_NAMES[period].toLowerCase()} a partir de agora.`)
      setPeriod('')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDue(null)
    }
  }

  if (options.length === 0) return null

  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Periodicidade: {PERIOD_NAMES[current]}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor={id}>Mudar para</Label>
          <select
            id={id}
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as BillingPeriod | '')
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring dark:bg-input/30 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2"
          >
            <option value="">Escolha</option>
            {options.map((option) => (
              <option key={option.period} value={option.period}>
                {PERIOD_NAMES[option.period]} · {formatBRL(option.price)} {option.label}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" disabled={!period || preview.isPending} onClick={() => void ask()}>
          {preview.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Mudar
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        A nova periodicidade começa agora; o que sobrou do período atual vira crédito.
      </p>
      {chosen && (
        <ConfirmDialog
          open={due !== null}
          onOpenChange={(open) => {
            if (!open) setDue(null)
          }}
          title={`Mudar para ${PERIOD_NAMES[chosen.period].toLowerCase()}?`}
          description={`Será cobrado agora ${formatBRL(due ?? 0)}: ${formatBRL(chosen.price)} do novo período, menos o que sobrou do atual. Depois, ${formatBRL(chosen.price)} ${chosen.label}.`}
          confirmLabel={`Pagar ${formatBRL(due ?? 0)} e mudar`}
          pending={changePeriod.isPending}
          onConfirm={() => void change()}
        />
      )}
    </div>
  )
}

function Card() {
  const card = useSavedCard()
  const [open, setOpen] = useState(false)
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium">Forma de pagamento</h3>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-sm tabular-nums">
          <CreditCard className="text-muted-foreground size-4" aria-hidden />
          {card.isPending
            ? 'Carregando o cartão…'
            : card.data
              ? cardLabel(card.data)
              : 'Nenhum cartão salvo.'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(true)
          }}
        >
          Trocar o cartão
        </Button>
      </div>
      <CardSheet open={open} onOpenChange={setOpen} />
    </div>
  )
}

function Payments() {
  const payments = useBillingPayments()
  return (
    <section
      aria-labelledby="payments-title"
      className="bg-card grid content-start gap-3 rounded-md border p-5"
    >
      <h2 id="payments-title" className="font-wide text-xl font-semibold">
        Pagamentos
      </h2>
      {!payments.data || payments.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma cobrança ainda.</p>
      ) : (
        <ul aria-label="Pagamentos" className="divide-y text-sm">
          {payments.data.map((payment) => (
            <li
              key={payment.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[6rem_1fr_auto_4.5rem]"
            >
              <span className="tabular-nums">{format(new Date(payment.at), 'dd/MM/yyyy')}</span>
              <span className="text-muted-foreground truncate">
                {payment.plan ?? 'Assinatura'}
                {payment.period && ` · ${PERIOD_NAMES[payment.period].toLowerCase()}`}
              </span>
              <span className="text-right font-medium tabular-nums">
                {formatBRL(payment.amount)}
              </span>
              <span className="col-start-3 justify-self-end sm:col-start-auto">
                {payment.status === 'paid' ? (
                  <Badge variant="secondary">Pago</Badge>
                ) : (
                  <Badge variant="destructive">Falhou</Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
