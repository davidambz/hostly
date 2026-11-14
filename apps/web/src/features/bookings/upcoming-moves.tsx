import { LogIn, LogOut } from 'lucide-react'

import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/utils'

import { type Booking, useCalendarBookings } from './api'
import { addDaysISO, formatNearDay } from './dates'
import { UPCOMING_DAYS, upcomingMoves } from './month-summary'
import { colorOf, type PropertyColor } from './property-colors'

/**
 * Who arrives and who leaves today and in the next days, and what is still to be received
 * from each guest arriving. Each line opens its booking.
 */
export function UpcomingMoves({
  today,
  propertyId,
  colors,
  onOpenBooking,
}: {
  today: string
  propertyId?: string
  colors: Map<string, PropertyColor>
  onOpenBooking: (booking: Booking) => void
}) {
  // From yesterday: a stay leaving today had its last night then.
  const bookings = useCalendarBookings({
    from: addDaysISO(today, -1),
    to: addDaysISO(today, UPCOMING_DAYS),
    propertyId,
  })
  const moves = upcomingMoves(today, bookings.data ?? [])

  return (
    <section aria-labelledby="upcoming-title" className="grid gap-2">
      <h2 id="upcoming-title" className="text-sm font-semibold">
        Próximos dias
      </h2>
      {bookings.isPending ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : moves.length === 0 ? (
        <p className="font-water text-muted-foreground text-sm">
          Ninguém chega nem sai nos próximos {UPCOMING_DAYS} dias.
        </p>
      ) : (
        <ul className="divide-border bg-card divide-y rounded-md border">
          {moves.map(({ date, kind, stay }) => {
            const arriving = kind === 'arrival'
            const due = arriving ? stay.financials.balanceDue : 0
            return (
              <li key={`${stay.id}-${kind}`}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenBooking(stay)
                  }}
                  className="hover:bg-muted/50 focus-visible:ring-ring grid w-full grid-cols-[5.5rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset sm:grid-cols-[6.5rem_6rem_minmax(0,1fr)_auto]"
                >
                  <span className={cn('font-medium', date === today && 'text-primary')}>
                    {formatNearDay(date, today)}
                  </span>
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    {arriving ? (
                      <LogIn className="size-4" aria-hidden />
                    ) : (
                      <LogOut className="size-4" aria-hidden />
                    )}
                    {arriving ? 'Chega' : 'Sai'}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'size-2.5 shrink-0 rounded-[2px]',
                        colorOf(colors, stay.property.id).dot,
                      )}
                    />
                    <span className="truncate">
                      <span className="font-medium">{stay.guestName}</span>
                      <span className="text-muted-foreground"> · {stay.property.name}</span>
                    </span>
                  </span>
                  {due > 0 && (
                    <span className="text-warning col-start-3 text-sm font-medium tabular-nums sm:col-start-auto">
                      falta {formatBRL(due)}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
