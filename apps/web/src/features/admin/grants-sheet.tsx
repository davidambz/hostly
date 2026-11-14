import { Loader2 } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { toast } from 'sonner'

import { TextareaField } from '@/components/form/textarea-field'
import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
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

import {
  type AdminUser,
  type GrantDuration,
  type PlanGrant,
  useAdminPlans,
  useChangeGrantPlan,
  useGrantPlan,
  useRenewGrant,
  useRevokeGrant,
  useUserGrants,
} from './api'
import { ACTION_LABELS, DURATIONS, momentLabel, untilLabel } from './grant-labels'

/**
 * A user's plan, as the backoffice manages it: give a plan for 1 month, 6 months, 1 year or
 * for life; renew, change or revoke the grant in force; and every grant's history.
 */
export function GrantsSheet({
  user,
  open,
  onOpenChange,
}: {
  user?: AdminUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Plano de {user?.name ?? ''}</SheetTitle>
          <SheetDescription>
            Concessões são cortesia: não passam pela cobrança e ficam no histórico.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-6">{user && <Grants key={user.id} user={user} />}</div>
      </SheetContent>
    </Sheet>
  )
}

function Grants({ user }: { user: AdminUser }) {
  const grants = useUserGrants(user.id)
  if (grants.isPending) return <LoadingState rows={2} />
  if (grants.isError) {
    return <ErrorState message={errorMessage(grants.error)} onRetry={() => void grants.refetch()} />
  }
  const current = grants.data.find((grant) => grant.inForce)

  return (
    <>
      {current ? <CurrentGrant grant={current} /> : <NewGrant user={user} />}
      <History grants={grants.data} />
    </>
  )
}

/** The grant in force, and what can be done to it. */
function CurrentGrant({ grant }: { grant: PlanGrant }) {
  const [action, setAction] = useState<'renew' | 'plan' | 'revoke' | null>(null)

  return (
    <section aria-labelledby="current-grant" className="grid gap-3 rounded-lg border p-4">
      <h3 id="current-grant" className="text-sm font-medium">
        Concessão em vigor
      </h3>
      <p className="flex flex-wrap items-center gap-2">
        <Badge>{grant.plan.name}</Badge>
        <span className="text-sm">até {untilLabel(grant.endsAt)}</span>
      </p>
      <p className="text-muted-foreground text-sm">{grant.reason}</p>
      {action === null ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAction('renew')
            }}
          >
            Renovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAction('plan')
            }}
          >
            Trocar plano
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAction('revoke')
            }}
          >
            Revogar
          </Button>
        </div>
      ) : (
        <GrantAction
          grant={grant}
          action={action}
          onDone={() => {
            setAction(null)
          }}
        />
      )}
    </section>
  )
}

function GrantAction({
  grant,
  action,
  onDone,
}: {
  grant: PlanGrant
  action: 'renew' | 'plan' | 'revoke'
  onDone: () => void
}) {
  const renew = useRenewGrant()
  const change = useChangeGrantPlan()
  const revoke = useRevokeGrant()
  const [duration, setDuration] = useState<GrantDuration>('ONE_MONTH')
  const [planId, setPlanId] = useState('')
  const [reason, setReason] = useState('')
  const pending = renew.isPending || change.isPending || revoke.isPending

  const submit = async () => {
    try {
      if (action === 'renew') await renew.mutateAsync({ id: grant.id, duration, reason })
      if (action === 'plan') await change.mutateAsync({ id: grant.id, planId, reason })
      if (action === 'revoke') await revoke.mutateAsync({ id: grant.id, reason })
      toast.success(
        { renew: 'Concessão renovada.', plan: 'Plano trocado.', revoke: 'Concessão revogada.' }[
          action
        ],
      )
      onDone()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="grid gap-3">
      {action === 'renew' && (
        <DurationField value={duration} onChange={setDuration} label="Renovar por" />
      )}
      {action === 'plan' && (
        <PlanField value={planId} onChange={setPlanId} exclude={grant.plan.id} />
      )}
      <TextareaField
        label="Motivo"
        rows={2}
        maxLength={500}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value)
        }}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={action === 'revoke' ? 'destructive' : 'default'}
          disabled={pending || !reason.trim() || (action === 'plan' && !planId)}
          onClick={() => void submit()}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {{ renew: 'Renovar', plan: 'Trocar plano', revoke: 'Revogar' }[action]}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/** Give the user a plan, from now. */
function NewGrant({ user }: { user: AdminUser }) {
  const grantPlan = useGrantPlan(user.id)
  const [planId, setPlanId] = useState('')
  const [duration, setDuration] = useState<GrantDuration>('ONE_MONTH')
  const [reason, setReason] = useState('')

  const submit = async () => {
    try {
      await grantPlan.mutateAsync({ planId, duration, reason })
      toast.success(`Plano concedido a ${user.name}.`)
      setReason('')
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <section aria-labelledby="new-grant" className="grid gap-4 rounded-lg border p-4">
      <div>
        <h3 id="new-grant" className="text-sm font-medium">
          Conceder plano
        </h3>
        <p className="text-muted-foreground text-sm">
          Hoje no {user.plan.name}. A concessão começa agora.
        </p>
      </div>
      <PlanField value={planId} onChange={setPlanId} />
      <DurationField value={duration} onChange={setDuration} label="Por quanto tempo" />
      <TextareaField
        label="Motivo"
        rows={2}
        maxLength={500}
        placeholder="ex.: parceiro, cliente antigo, teste"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value)
        }}
      />
      <div>
        <Button
          disabled={grantPlan.isPending || !planId || !reason.trim()}
          onClick={() => void submit()}
        >
          {grantPlan.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Conceder
        </Button>
      </div>
    </section>
  )
}

/** The plans that can be given: on sale and not Free. */
function PlanField({
  value,
  onChange,
  exclude,
}: {
  value: string
  onChange: (planId: string) => void
  exclude?: string
}) {
  const plans = useAdminPlans()
  const id = useId()
  const options = (plans.data ?? []).filter(
    (plan) => plan.active && plan.code !== 'free' && plan.id !== exclude,
  )
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Plano</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
      >
        <option value="">Escolha o plano</option>
        {options.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function DurationField({
  value,
  onChange,
  label,
}: {
  value: GrantDuration
  onChange: (duration: GrantDuration) => void
  label: ReactNode
}) {
  const id = useId()
  return (
    <div className="grid gap-2">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={id}
        value={value}
        onValueChange={(next) => {
          onChange(next as GrantDuration)
        }}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        {DURATIONS.map((duration) => (
          <label key={duration.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value={duration.value} />
            {duration.label}
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

/** Every grant, newest first, with each action taken on it. */
function History({ grants }: { grants: PlanGrant[] }) {
  return (
    <section aria-labelledby="grant-history" className="grid gap-3">
      <h3 id="grant-history" className="text-sm font-medium">
        Histórico
      </h3>
      {grants.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma concessão até hoje.</p>
      ) : (
        <ol className="grid gap-3">
          {grants
            .flatMap((grant) => grant.events.map((event) => ({ grant, event })))
            .sort((a, b) => b.event.at.localeCompare(a.event.at))
            .map(({ grant, event }) => (
              <li
                key={`${grant.id}-${event.at}-${event.action}`}
                className="grid gap-0.5 border-l-2 pl-3 text-sm"
              >
                <span className="font-medium">
                  {ACTION_LABELS[event.action]}: {event.plan.name}
                  {event.action !== 'REVOKED' && `, até ${untilLabel(event.endsAt)}`}
                </span>
                <span className="text-muted-foreground">{event.reason}</span>
                <span className="text-muted-foreground text-xs">
                  {momentLabel(event.at)} · {event.actor?.name ?? 'conta removida'}
                </span>
              </li>
            ))}
        </ol>
      )}
    </section>
  )
}
