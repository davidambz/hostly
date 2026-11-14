import { useState } from 'react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MonthChart } from '@/features/reports/month-chart'
import { formatOccupancy } from '@/features/reports/report-format'
import { axisBRL } from '@/features/reports/year'
import { formatBRL } from '@/lib/money'

import { DEMO_YEAR, demoMonths, demoYear } from './season-demo'

/** The year-by-month report as the app draws it, on a made-up beach house. */
export function SeasonReport() {
  const [measure, setMeasure] = useState<'revenue' | 'occupancy'>('revenue')
  const year = demoYear()
  const figures = [
    { label: 'Ocupação no ano', value: formatOccupancy(year.occupancyBps) },
    { label: 'Noites vendidas', value: `${String(year.nights)} de ${String(year.days)}` },
    { label: 'Diária média', value: formatBRL(year.averageDailyRate) },
    { label: 'Receita no ano', value: formatBRL(year.revenue) },
  ]

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">Casa da Praia</span>{' '}
          <span className="font-water text-muted-foreground">
            · {DEMO_YEAR} contra {DEMO_YEAR - 1}, dados fictícios
          </span>
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={measure}
          aria-label="O que o gráfico mostra"
          onValueChange={(value) => {
            if (value === 'revenue' || value === 'occupancy') setMeasure(value)
          }}
        >
          <ToggleGroupItem value="revenue">Receita</ToggleGroupItem>
          <ToggleGroupItem value="occupancy">Ocupação</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {measure === 'revenue' ? (
        <MonthChart
          title="Receita por mês"
          year={DEMO_YEAR}
          months={demoMonths('revenue')}
          format={formatBRL}
          axisFormat={axisBRL}
        />
      ) : (
        <MonthChart
          title="Ocupação por mês"
          year={DEMO_YEAR}
          months={demoMonths('occupancy')}
          format={formatOccupancy}
          max={10_000}
        />
      )}
      <dl className="bg-grid-line grid grid-cols-2 gap-px overflow-hidden rounded-md border lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-card grid gap-1 p-3">
            <dt className="text-muted-foreground text-sm">{figure.label}</dt>
            <dd className="font-wide text-lg leading-tight font-semibold tabular-nums">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
