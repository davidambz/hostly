import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL, maskMoney, parseMoney } from '@/lib/money'

import { type PaymentInput, useAddPayment, useDeletePayment, usePayments } from './api'
import { formatShortDate, todayISO } from './dates'

/**
 * What the guest paid, entry by entry, in an existing booking: each payment with its day,
 * a way to record the next one, and one click to settle what is still due. `onPaidChange`
 * hears the new total paid, for the summary beside it.
 */
export function PaymentsSection({
  bookingId,
  due,
  onPaidChange,
}: {
  bookingId: string
  /** What is still to receive, in cents, or null while it is being worked out. */
  due: number | null
  onPaidChange: (paid: number) => void
}) {
  const payments = usePayments(bookingId)
  const add = useAddPayment(bookingId)
  const remove = useDeletePayment(bookingId)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todayISO)
  const [note, setNote] = useState('')
  const ids = { amount: useId(), paidOn: useId(), note: useId() }

  const paid = payments.data?.reduce((sum, payment) => sum + payment.amount, 0)
  useEffect(() => {
    if (paid !== undefined) onPaidChange(paid)
  }, [paid, onPaidChange])

  const record = async (input: PaymentInput, done: string) => {
    try {
      await add.mutateAsync(input)
      setAmount('')
      setNote('')
      toast.success(done)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const cents = parseMoney(amount)

  return (
    <section aria-labelledby={`${ids.amount}-title`} className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${ids.amount}-title`} className="text-sm font-medium">
          Pagamentos
        </h3>
        {due !== null && due > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={add.isPending}
            onClick={() =>
              void record({ amount: due, paidOn: todayISO(), note: 'Restante' }, 'Reserva quitada.')
            }
          >
            <Check aria-hidden />
            Quitar {formatBRL(due)}
          </Button>
        )}
      </div>

      {payments.isPending ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : payments.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage(payments.error)}
        </p>
      ) : payments.data.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum pagamento ainda.</p>
      ) : (
        <ul className="divide-y text-sm">
          {payments.data.map((payment) => (
            <li key={payment.id} className="flex items-center gap-3 py-1.5">
              <span className="text-muted-foreground w-12 tabular-nums">
                {formatShortDate(payment.paidOn)}
              </span>
              <span className="font-medium tabular-nums">{formatBRL(payment.amount)}</span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate">{payment.note}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Excluir o pagamento de ${formatBRL(payment.amount)} de ${formatShortDate(payment.paidOn)}`}
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(payment.id, {
                    onSuccess: () => toast.success('Pagamento excluído.'),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Not a <form>: it sits inside the booking's. */}
      <div
        role="group"
        aria-label="Registrar pagamento"
        className="grid items-end gap-2 sm:grid-cols-[8rem_9.5rem_minmax(0,1fr)_auto]"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={ids.amount}>Valor</Label>
          <Input
            id={ids.amount}
            inputMode="numeric"
            placeholder="R$"
            value={amount}
            onChange={(event) => {
              setAmount(maskMoney(event.target.value))
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.paidOn}>Dia</Label>
          <Input
            id={ids.paidOn}
            type="date"
            value={paidOn}
            onChange={(event) => {
              setPaidOn(event.target.value)
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.note}>Observação</Label>
          <Input
            id={ids.note}
            placeholder="ex.: Pix"
            maxLength={255}
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
          />
        </div>
        <Button
          type="button"
          disabled={add.isPending || !cents || !paidOn}
          onClick={() =>
            void record({ amount: cents ?? 0, paidOn, note: note || null }, 'Pagamento registrado.')
          }
        >
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Registrar
        </Button>
      </div>
    </section>
  )
}
