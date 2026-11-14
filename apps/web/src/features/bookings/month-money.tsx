import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/utils'

import { useCalendarBookings } from './api'
import { parseDate } from './dates'
import { monthMoney } from './month-summary'
import { monthBounds } from './occupancy'

/**
 * The month's money, beside its occupancy: what the bookings that check in this month add
 * up to, what came in, what is still to come in and what goes to the brokers.
 */
export function MonthMoney({ date, propertyId }: { date: string; propertyId?: string }) {
  const bounds = monthBounds(date)
  const bookings = useCalendarBookings({ ...bounds, propertyId })
  const money = monthMoney(date, bookings.data ?? [])
  const monthName = format(parseDate(bounds.from), 'MMMM', { locale: ptBR })
  const figures = [
    { label: 'Total', value: money.total },
    { label: 'Recebido', value: money.paid },
    { label: 'A receber', value: money.due, strong: true },
    { label: 'Comissões', value: money.fees },
  ]

  return (
    <section aria-labelledby="month-money-title" className="grid gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="month-money-title" className="text-sm font-semibold">
          Dinheiro de {monthName}
        </h2>
        <p className="font-water text-muted-foreground text-sm">
          {money.bookings === 1
            ? '1 reserva com entrada no mês.'
            : `${String(money.bookings)} reservas com entrada no mês.`}
        </p>
      </div>
      <dl className="bg-grid-line grid grid-cols-2 gap-px overflow-hidden rounded-md border sm:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-card grid gap-1 p-3">
            <dt className="text-muted-foreground text-sm">{figure.label}</dt>
            <dd
              className={cn(
                'font-wide text-xl leading-tight font-semibold tabular-nums',
                figure.strong && figure.value > 0 && 'text-primary',
              )}
            >
              {bookings.isPending ? '–' : formatBRL(figure.value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
