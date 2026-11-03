import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { type PointerEvent, useEffect, useState } from 'react'

import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { errorMessage } from '@/lib/api/form-errors'
import { cn } from '@/lib/utils'

import { type Booking, useCalendarBookings } from './api'
import { layoutWeek, type Segment, staysPerDay } from './calendar-layout'
import {
  addDaysISO,
  addMonthsISO,
  formatLongDate,
  formatMonth,
  formatStay,
  isSameMonthISO,
  monthWeeks,
  parseDate,
  todayISO,
  WEEKDAYS,
  weekDays,
} from './dates'
import { colorOf, type PropertyColor } from './property-colors'

export type CalendarView = 'month' | 'week'

/** Stays shown per day in the month view; the rest go behind "+N". */
const MONTH_LANES = 3
/** Height of one stay bar and the gap below it, in rem. */
const LANE_REM = 1.5
/** Room for the day number at the top of each day, in rem. */
const DAY_HEADER_REM = 1.75
/** The grout between tiles, in px. */
const GROUT_PX = 3

/** Left edge of column `index` in a row of 7 tiles separated by grout. */
function columnLeft(index: number) {
  return `calc((100% - ${String(6 * GROUT_PX)}px) / 7 * ${String(index)} + ${String(index * GROUT_PX)}px)`
}

/** Width of `span` columns, grout between them included. */
function columnsWidth(span: number) {
  return `calc((100% - ${String(6 * GROUT_PX)}px) / 7 * ${String(span)} + ${String((span - 1) * GROUT_PX)}px)`
}

interface Selection {
  anchor: string
  current: string
}

function selectedRange(selection: Selection | null): [string, string] | null {
  if (!selection) return null
  return selection.anchor <= selection.current
    ? [selection.anchor, selection.current]
    : [selection.current, selection.anchor]
}

/** The first and last day shown, and the title, for a view of `date`. */
function visibleWeeks(view: CalendarView, date: string): string[][] {
  return view === 'month' ? monthWeeks(date) : [weekDays(date)]
}

function title(view: CalendarView, date: string): string {
  if (view === 'month') return formatMonth(date)
  const days = weekDays(date)
  return formatStay(days[0] ?? date, days[6] ?? date)
}

/**
 * A calendar of stays, like all-day events: a month or a week, a bar per stay in its
 * property's color. Clicking (or dragging across) free days starts a booking on them;
 * clicking a bar opens that booking.
 */
export function BookingsCalendar({
  view,
  date,
  propertyId,
  colors,
  onViewChange,
  onDateChange,
  onSelectDays,
  onOpenBooking,
}: {
  view: CalendarView
  /** Any day of the month or week shown, `YYYY-MM-DD`. */
  date: string
  propertyId?: string
  colors: Map<string, PropertyColor>
  /** With a day, the view also moves to it. */
  onViewChange: (view: CalendarView, day?: string) => void
  onDateChange: (date: string) => void
  /** The nights picked: from check-in to check-out (exclusive). */
  onSelectDays: (checkIn: string, checkOut: string) => void
  onOpenBooking: (booking: Booking) => void
}) {
  const weeks = visibleWeeks(view, date)
  const first = weeks[0]?.[0] ?? date
  const last = weeks[weeks.length - 1]?.[6] ?? date
  const bookings = useCalendarBookings({ from: first, to: addDaysISO(last, 1), propertyId })
  const today = todayISO()
  const [selection, setSelection] = useState<Selection | null>(null)
  const range = selectedRange(selection)

  // A drag ends wherever the pointer is released, even outside the calendar.
  useEffect(() => {
    if (!selection) return
    const finish = () => {
      const [from, to] = selectedRange(selection) ?? [selection.anchor, selection.anchor]
      setSelection(null)
      onSelectDays(from, addDaysISO(to, 1))
    }
    // A cancelled gesture (the page scrolled under a finger) picks nothing.
    const cancel = () => {
      setSelection(null)
    }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [selection, onSelectDays])

  const step = (direction: 1 | -1) => {
    onDateChange(view === 'month' ? addMonthsISO(date, direction) : addDaysISO(date, 7 * direction))
  }

  return (
    <section aria-label="Calendário de reservas" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onDateChange(today)
          }}
        >
          Hoje
        </Button>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label={view === 'month' ? 'Mês anterior' : 'Semana anterior'}
            onClick={() => {
              step(-1)
            }}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={view === 'month' ? 'Próximo mês' : 'Próxima semana'}
            onClick={() => {
              step(1)
            }}
          >
            <ChevronRight />
          </Button>
        </div>
        <h2
          className="font-display text-2xl leading-none tracking-tight first-letter:uppercase"
          aria-live="polite"
        >
          {title(view, date)}
        </h2>
        {bookings.isFetching && (
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Carregando" />
        )}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="ml-auto"
          value={view}
          aria-label="Visão do calendário"
          onValueChange={(value) => {
            if (value === 'month' || value === 'week') onViewChange(value)
          }}
        >
          <ToggleGroupItem value="month">Mês</ToggleGroupItem>
          <ToggleGroupItem value="week">Semana</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {bookings.isError ? (
        <ErrorState
          message={errorMessage(bookings.error)}
          onRetry={() => void bookings.refetch()}
        />
      ) : (
        <div className="bg-grout grid gap-[3px] overflow-hidden rounded-md p-[3px] select-none">
          <div className="grid grid-cols-7 gap-[3px]" aria-hidden>
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="bg-card text-muted-foreground rounded-[2px] px-2 py-1.5 text-xs font-medium tracking-wide uppercase"
              >
                {weekday}
              </div>
            ))}
          </div>
          {weeks.map((days) => (
            <WeekRow
              key={days[0]}
              days={days}
              view={view}
              anchor={date}
              today={today}
              bookings={bookings.data ?? []}
              colors={colors}
              range={range}
              onPointerDownDay={(day) => {
                setSelection({ anchor: day, current: day })
              }}
              onPointerEnterDay={(day) => {
                setSelection((current) => (current ? { ...current, current: day } : current))
              }}
              onKeyboardSelectDay={(day) => {
                onSelectDays(day, addDaysISO(day, 1))
              }}
              onOpenBooking={onOpenBooking}
              onShowWeek={(day) => {
                onViewChange('week', day)
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function WeekRow({
  days,
  view,
  anchor,
  today,
  bookings,
  colors,
  range,
  onPointerDownDay,
  onPointerEnterDay,
  onKeyboardSelectDay,
  onOpenBooking,
  onShowWeek,
}: {
  days: string[]
  view: CalendarView
  anchor: string
  today: string
  bookings: Booking[]
  colors: Map<string, PropertyColor>
  range: [string, string] | null
  onPointerDownDay: (day: string) => void
  onPointerEnterDay: (day: string) => void
  onKeyboardSelectDay: (day: string) => void
  onOpenBooking: (booking: Booking) => void
  onShowWeek: (day: string) => void
}) {
  const segments = layoutWeek(days, bookings)
  const lanes = view === 'month' ? MONTH_LANES : Math.max(1, ...segments.map((s) => s.lane + 1))
  const visible = segments.filter((segment) => segment.lane < lanes)
  const perDay = staysPerDay(segments, days.length)
  const shownPerDay = staysPerDay(visible, days.length)
  const minHeight =
    view === 'month'
      ? `${DAY_HEADER_REM + LANE_REM * (MONTH_LANES + 1)}rem`
      : `max(16rem, ${DAY_HEADER_REM + LANE_REM * (lanes + 1)}rem)`

  return (
    <div className="relative grid grid-cols-7 gap-[3px]" style={{ minHeight }}>
      {days.map((day, index) => {
        const hidden = (perDay[index] ?? 0) - (shownPerDay[index] ?? 0)
        const selected = range !== null && day >= range[0] && day <= range[1]
        const outside = view === 'month' && !isSameMonthISO(day, anchor)
        return (
          <div
            key={day}
            style={{ animationDelay: `${String(index * 30)}ms` }}
            className={cn(
              // A quieter motif than the home page's: here the bars are the content.
              'azulejo animate-tile-settle relative rounded-[2px] [--tile-ink:color-mix(in_oklab,var(--glaze)_55%,var(--card))]',
              outside && 'bg-muted [--tile-ink:var(--glaze-strong)]',
              selected && 'ring-primary bg-accent ring-2 ring-inset',
            )}
          >
            <button
              type="button"
              data-day={day}
              aria-label={`Nova reserva com entrada em ${formatLongDate(day)}`}
              className="hover:bg-accent/40 focus-visible:ring-ring absolute inset-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset"
              onPointerDown={(event: PointerEvent) => {
                if (event.button === 0) onPointerDownDay(day)
              }}
              onPointerEnter={() => {
                onPointerEnterDay(day)
              }}
              onClick={(event) => {
                // Pointer clicks are handled as a one-day drag; this is Enter or Space.
                if (event.detail === 0) onKeyboardSelectDay(day)
              }}
            />
            <span
              className={cn(
                'font-display pointer-events-none relative m-1 inline-flex size-6 items-center justify-center rounded-[3px] text-sm',
                outside && 'text-muted-foreground',
                day === today && 'bg-primary text-primary-foreground',
              )}
              aria-hidden
            >
              {parseDate(day).getDate()}
            </span>
            {hidden > 0 && (
              <button
                type="button"
                aria-label={`${String(hidden)} ${hidden === 1 ? 'reserva' : 'reservas'} a mais em ${formatLongDate(day)}`}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute bottom-0.5 left-0 mx-1 rounded-sm px-0.5 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2"
                onClick={() => {
                  onShowWeek(day)
                }}
              >
                +{hidden}
                <span className="hidden md:inline"> {hidden === 1 ? 'reserva' : 'reservas'}</span>
              </button>
            )}
          </div>
        )
      })}
      {visible.map((segment) => (
        <StayBar
          key={segment.item.id}
          segment={segment}
          color={colorOf(colors, segment.item.property.id)}
          index={segment.lane * 7 + segment.start}
          onOpen={onOpenBooking}
        />
      ))}
    </div>
  )
}

function StayBar({
  segment,
  color,
  index,
  onOpen,
}: {
  segment: Segment<Booking>
  color: PropertyColor
  /** Order on the wall, for the paint stagger. */
  index: number
  onOpen: (booking: Booking) => void
}) {
  const booking = segment.item
  const label = `${booking.guestName}, ${booking.property.name}, ${formatStay(booking.checkIn, booking.checkOut)}`
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'focus-visible:ring-ring animate-paint absolute h-5 truncate rounded-[3px] px-2 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        color.bar,
        segment.continuesBefore && 'rounded-l-none',
        segment.continuesAfter && 'rounded-r-none',
      )}
      style={{
        top: `${DAY_HEADER_REM + 0.25 + segment.lane * LANE_REM}rem`,
        left: `calc(${columnLeft(segment.start)} + ${segment.continuesBefore ? 0 : 3}px)`,
        width: `calc(${columnsWidth(segment.span)} - ${(segment.continuesBefore ? 0 : 3) + (segment.continuesAfter ? 0 : 3)}px)`,
        animationDelay: `${String(150 + Math.min(index, 20) * 25)}ms`,
      }}
      onClick={() => {
        onOpen(booking)
      }}
    >
      {booking.guestName}
      {/* The property too, not only its color: it shows wherever the bar has room. */}
      <span className="font-normal opacity-80"> · {booking.property.name}</span>
    </button>
  )
}
