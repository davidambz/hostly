import { CalendarDays, Loader2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import { useCalendarBookings } from './api'
import {
  addMonthsISO,
  formatShortDate,
  formatStay,
  nightsBetween,
  nightsLabel,
  parseDate,
  todayISO,
  toISODate,
} from './dates'
import { firstConflict, occupiedNights } from './occupied-nights'

/** The first day of the month of `date`. */
function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`
}

/**
 * Check-in and check-out picked as a range on a calendar, in a popover. Once a property is
 * chosen, its taken nights show struck through, and a range over any of them is refused
 * there, before saving: check-out on another guest's check-in day is fine.
 */
export function DateRangeField({
  checkIn,
  checkOut,
  onChange,
  error,
  propertyId,
  exceptBookingId,
  fallbackMonth,
}: {
  checkIn: string
  checkOut: string
  onChange: (range: { checkIn: string; checkOut: string }) => void
  error?: string
  /** The property whose taken nights to show. */
  propertyId?: string
  /** The booking being edited: its own nights are not in the way. */
  exceptBookingId?: string
  /** Where the calendar opens with no dates yet (the month the user was looking at). */
  fallbackMonth?: string
}) {
  const [open, setOpen] = useState(false)
  // Two months side by side on a large screen; one fits a phone.
  const months = useIsMobile() ? 1 : 2
  // Where the calendar starts: the stay's month, else the month the user was looking at.
  const startMonth = () => monthStart(checkIn !== '' ? checkIn : (fallbackMonth ?? todayISO()))
  const [month, setMonth] = useState(startMonth)
  const [conflict, setConflict] = useState<string>()
  const labelId = useId()
  const errorId = useId()
  const hintId = useId()
  const complete = checkIn !== '' && checkOut !== '' && checkOut > checkIn
  const selected: DateRange | undefined = checkIn
    ? { from: parseDate(checkIn), to: checkOut ? parseDate(checkOut) : undefined }
    : undefined

  const taken = useCalendarBookings(
    { from: month, to: addMonthsISO(month, months), propertyId },
    { enabled: open && Boolean(propertyId) },
  )
  const nights = useMemo(
    () => occupiedNights(taken.data ?? [], exceptBookingId),
    [taken.data, exceptBookingId],
  )

  return (
    <div className="grid gap-2">
      <Label id={labelId}>Datas</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          // Recomputed on every opening: the form outlives the month it was first shown on.
          if (next) setMonth(startMonth())
          setOpen(next)
          setConflict(undefined)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-labelledby={labelId}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              'aria-invalid:border-destructive w-full justify-start font-normal',
              !complete && 'text-muted-foreground',
            )}
          >
            <CalendarDays aria-hidden />
            {complete
              ? `${formatStay(checkIn, checkOut)} · ${nightsLabel(nightsBetween(checkIn, checkOut))}`
              : 'Escolha a entrada e a saída'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" aria-describedby={hintId}>
          <Calendar
            mode="range"
            locale={ptBR}
            numberOfMonths={months}
            month={parseDate(month)}
            onMonthChange={(next) => {
              setMonth(monthStart(toISODate(next)))
            }}
            selected={selected}
            // Check-out can't be check-in: a stay has at least one night.
            min={1}
            modifiers={{ taken: (day) => nights.has(toISODate(day)) }}
            modifiersClassNames={{
              taken:
                'text-muted-foreground line-through decoration-2 [&_button]:bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,transparent_4px_8px)]',
            }}
            onSelect={(range) => {
              const from = range?.from ? toISODate(range.from) : ''
              let to = range?.to ? toISODate(range.to) : ''
              if (to === from) to = ''
              const guest = from ? nights.get(from) : undefined
              if (guest !== undefined && !to) {
                setConflict(`A noite de ${formatShortDate(from)} já é de ${guest}.`)
                return
              }
              const clash = from && to ? firstConflict(nights, from, to) : undefined
              if (clash) {
                setConflict(
                  `Essas datas passam pela reserva de ${clash.guest} (noite de ${formatShortDate(clash.night)}). Escolha outra saída.`,
                )
                onChange({ checkIn: from, checkOut: '' })
                return
              }
              setConflict(undefined)
              onChange({ checkIn: from, checkOut: to })
              if (from && to) setOpen(false)
            }}
          />
          <div id={hintId} className="text-muted-foreground grid gap-1 border-t px-3 py-2 text-xs">
            {propertyId ? (
              <span className="flex items-center gap-1.5">
                {taken.isFetching ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className="bg-muted size-3 rounded-[2px] bg-[repeating-linear-gradient(135deg,var(--border)_0_2px,transparent_2px_4px)]"
                  />
                )}
                Noites riscadas já estão reservadas neste imóvel.
              </span>
            ) : (
              <span>Escolha o imóvel para ver as noites já reservadas.</span>
            )}
            {conflict && (
              <span role="alert" className="text-destructive font-medium">
                {conflict}
              </span>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
