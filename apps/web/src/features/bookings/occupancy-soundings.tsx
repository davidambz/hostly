import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { cn } from '@/lib/utils'

import { useCalendarBookings } from './api'
import { parseDate } from './dates'
import { type Depth, depthOf, monthBounds, monthOccupancy } from './occupancy'
import { colorOf, type PropertyColor } from './property-colors'

/** Whole class names per depth, so Tailwind finds them in the source. */
const DEPTH_CLASSES: Record<Depth, string> = {
  1: 'bg-depth-1 text-depth-1-foreground',
  2: 'bg-depth-2 text-depth-2-foreground',
  3: 'bg-depth-3 text-depth-3-foreground',
  4: 'bg-depth-4 text-depth-4-foreground',
  5: 'bg-depth-5 text-depth-5-foreground',
  6: 'bg-depth-6 text-depth-6-foreground',
}

/**
 * The month's occupancy read like soundings on a chart: one cell per property, its water as
 * deep as the share of nights booked, the number of nights written on it. Each cell is also
 * the property's color key for the calendar, and picking it shows only that property.
 */
export function OccupancySoundings({
  date,
  properties,
  colors,
  selected,
  onSelect,
}: {
  /** Any day of the month to sound. */
  date: string
  properties: { id: string; name: string }[]
  colors: Map<string, PropertyColor>
  /** The property the calendar is showing alone, if any. */
  selected?: string
  onSelect: (propertyId: string | undefined) => void
}) {
  const bounds = monthBounds(date)
  const bookings = useCalendarBookings(bounds)
  const { nights, days } = monthOccupancy(date, bookings.data ?? [])
  const monthName = format(parseDate(bounds.from), 'MMMM', { locale: ptBR })

  return (
    <section aria-labelledby="soundings-title" className="grid gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="soundings-title" className="text-sm font-semibold">
          Ocupação em {monthName}
        </h2>
        <p className="font-water text-muted-foreground text-sm">
          quanto mais fundo o azul, mais noites reservadas. Toque num imóvel para ver só ele.
        </p>
      </div>
      <ul
        aria-label="Ocupação dos imóveis"
        className="bg-grid-line grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-px overflow-hidden rounded-md border"
      >
        {properties.map((property, index) => {
          const booked = nights.get(property.id) ?? 0
          const pressed = selected === property.id
          return (
            <li key={property.id} className="flex">
              <button
                type="button"
                // Keyed by month, so the tide comes in again when the month changes.
                key={bounds.from}
                aria-pressed={pressed}
                aria-label={`${property.name}: ${String(booked)} de ${String(days)} noites reservadas em ${monthName}`}
                onClick={() => {
                  onSelect(pressed ? undefined : property.id)
                }}
                style={{ animationDelay: `${String(index * 70)}ms` }}
                className={cn(
                  'animate-tide focus-visible:ring-ring relative flex min-h-24 w-full flex-col justify-between gap-3 p-3 text-left transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-inset',
                  DEPTH_CLASSES[depthOf(booked, days)],
                  selected !== undefined && !pressed && 'opacity-55 hover:opacity-80',
                  pressed && 'ring-ring ring-2 ring-inset',
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span
                    aria-hidden
                    className={cn(
                      'size-2.5 shrink-0 rounded-[2px] ring-2 ring-card',
                      colorOf(colors, property.id).dot,
                    )}
                  />
                  <span className="truncate">{property.name}</span>
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-wide text-3xl leading-none font-semibold tabular-nums">
                    {bookings.isPending ? '–' : booked}
                  </span>
                  <span className="font-water text-xs opacity-80">de {days} noites</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
