import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { addDaysISO, todayISO } from '@/features/bookings/dates'

import {
  customPeriod,
  MAX_PERIOD_DAYS,
  type Period,
  PERIOD_KINDS,
  type PeriodKind,
  periodDays,
  periodLabel,
  periodOf,
  shiftPeriod,
} from './period'

export function PeriodPicker({
  period,
  onChange,
  loading,
}: {
  period: Period
  onChange: (period: Period) => void
  loading: boolean
}) {
  const id = useId()
  const lastDay = addDaysISO(period.to, -1)

  const changeKind = (kind: PeriodKind) => {
    onChange(
      kind === 'custom'
        ? customPeriod(period.from, lastDay)
        : periodOf(kind, period.kind === 'custom' ? todayISO() : period.from),
    )
  }

  const changeCustom = (first: string, last: string) => {
    if (!first || !last || first > last) return
    const next = customPeriod(first, last)
    if (periodDays(next) <= MAX_PERIOD_DAYS) onChange(next)
  }

  return (
    <section aria-label="Período" className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={period.kind}
        aria-label="Tipo de período"
        onValueChange={(value) => {
          const kind = PERIOD_KINDS.find((item) => item.kind === value)?.kind
          if (kind) changeKind(kind)
        }}
      >
        {PERIOD_KINDS.map((item) => (
          <ToggleGroupItem key={item.kind} value={item.kind}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {period.kind === 'custom' ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-from`}>De</Label>
            <Input
              id={`${id}-from`}
              type="date"
              className="w-40"
              value={period.from}
              max={lastDay}
              onChange={(event) => {
                changeCustom(event.target.value, lastDay)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-to`}>Até</Label>
            <Input
              id={`${id}-to`}
              type="date"
              className="w-40"
              value={lastDay}
              min={period.from}
              onChange={(event) => {
                changeCustom(period.from, event.target.value)
              }}
            />
          </div>
          <p className="font-water text-muted-foreground pb-2 text-xs">Até 2 anos.</p>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Período anterior"
            onClick={() => {
              onChange(shiftPeriod(period, -1))
            }}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2
            className="font-wide min-w-44 text-center text-lg font-semibold first-letter:uppercase"
            aria-live="polite"
          >
            {periodLabel(period)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo período"
            onClick={() => {
              onChange(shiftPeriod(period, 1))
            }}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
      {loading && (
        <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Carregando" />
      )}
    </section>
  )
}
