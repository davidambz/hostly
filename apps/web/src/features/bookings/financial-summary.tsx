import { Loader2 } from 'lucide-react'

import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL, formatPercent } from '@/lib/money'
import { cn } from '@/lib/utils'

import { type QuoteInput, useQuote } from './api'
import { nightsBetween, nightsLabel } from './dates'

/** How long the form waits after the last keystroke before asking for a quote. */
export const QUOTE_DEBOUNCE_MS = 400

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn('flex justify-between gap-4', muted && 'text-muted-foreground')}>
      <dt>{label}</dt>
      <dd className={cn('tabular-nums', strong && 'font-semibold')}>{value}</dd>
    </div>
  )
}

/**
 * The money of the booking being filled in, worked out by the API (`POST /bookings/quote`),
 * so what the form shows is exactly what will be saved.
 */
export function FinancialSummary({ input }: { input: QuoteInput | null }) {
  const quote = useQuote(input)

  return (
    <section
      aria-label="Resumo financeiro"
      aria-busy={quote.isFetching}
      className="bg-muted/50 grid gap-3 rounded-lg border p-4 text-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Resumo</h3>
        {quote.isFetching && (
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
        )}
      </div>
      {input === null ? (
        <p className="text-muted-foreground">Escolha as datas e a diária para ver os valores.</p>
      ) : quote.isError ? (
        <p className="text-destructive" role="alert">
          {errorMessage(quote.error)}
        </p>
      ) : quote.data ? (
        <dl className="grid gap-1.5">
          <Row
            label={`${nightsLabel(nightsBetween(input.checkIn, input.checkOut))} × ${formatBRL(input.nightlyRate)}`}
            value={formatBRL(quote.data.grossLodging)}
          />
          {(input.discount ?? 0) > 0 && (
            <Row label="Desconto" value={`− ${formatBRL(input.discount ?? 0)}`} />
          )}
          {(input.cleaningFee ?? 0) > 0 && (
            <Row label="Limpeza" value={formatBRL(input.cleaningFee ?? 0)} />
          )}
          <Row label="Total do hóspede" value={formatBRL(quote.data.total)} strong />
          {quote.data.brokerFee > 0 && (
            <Row
              label={`Comissão (${formatPercent(input.brokerCommissionBps ?? 0)} das diárias)`}
              value={`− ${formatBRL(quote.data.brokerFee)}`}
              muted
            />
          )}
          <Row label="Você recebe" value={formatBRL(quote.data.net)} strong />
          <div className="my-1 border-t" />
          <Row label="Já pago" value={formatBRL(input.amountPaid ?? 0)} muted />
          <Row
            label="Falta receber"
            value={quote.data.balanceDue === 0 ? 'Quitado' : formatBRL(quote.data.balanceDue)}
            strong
          />
        </dl>
      ) : (
        <p className="text-muted-foreground">Calculando…</p>
      )}
    </section>
  )
}
