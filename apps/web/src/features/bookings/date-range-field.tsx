import { CalendarDays } from 'lucide-react'
import { useId, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import { formatStay, nightsBetween, nightsLabel, parseDate, toISODate } from './dates'

/** Check-in and check-out picked as a range on a calendar, in a popover. */
export function DateRangeField({
  checkIn,
  checkOut,
  onChange,
  error,
}: {
  checkIn: string
  checkOut: string
  onChange: (range: { checkIn: string; checkOut: string }) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  // Two months side by side on a large screen; one fits a phone.
  const months = useIsMobile() ? 1 : 2
  const labelId = useId()
  const errorId = useId()
  const complete = checkIn !== '' && checkOut !== '' && checkOut > checkIn
  const selected: DateRange | undefined = checkIn
    ? { from: parseDate(checkIn), to: checkOut ? parseDate(checkOut) : undefined }
    : undefined

  return (
    <div className="grid gap-2">
      <Label id={labelId}>Datas</Label>
      <Popover open={open} onOpenChange={setOpen}>
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
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            locale={ptBR}
            numberOfMonths={months}
            defaultMonth={selected?.from}
            selected={selected}
            // Check-out can't be check-in: a stay has at least one night.
            min={1}
            onSelect={(range) => {
              const from = range?.from ? toISODate(range.from) : ''
              const to = range?.to ? toISODate(range.to) : ''
              onChange({ checkIn: from, checkOut: to === from ? '' : to })
              if (from && to && to !== from) setOpen(false)
            }}
          />
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
