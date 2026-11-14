import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAllProperties } from '@/features/properties/api'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'

import { type MonthlyReport, useMonthly } from './api'
import { type ChartMonth, MonthChart } from './month-chart'
import { formatOccupancy } from './report-format'
import { ReportTabs } from './report-tabs'
import { axisBRL, longMonth, seasonHighlights, shortMonth, yearFromSearch } from './year'

export function YearPage() {
  const [params, setParams] = useSearchParams()
  const year = yearFromSearch(params)
  const properties = useAllProperties()
  const known = properties.data?.some((property) => property.id === params.get('imovel'))
  const propertyId = known ? (params.get('imovel') ?? undefined) : undefined
  const current = useMonthly({ year, propertyId })
  const previous = useMonthly({ year: year - 1, propertyId })

  const set = (changes: Record<string, string | undefined>) => {
    setParams(
      (now) => {
        const next = new URLSearchParams(now)
        for (const [name, value] of Object.entries(changes)) {
          if (value) next.set(name, value)
          else next.delete(name)
        }
        return next
      },
      { replace: true },
    )
  }

  const chartMonths = (read: (month: MonthlyReport['months'][number]) => number) =>
    (current.data?.months ?? []).map((month, index): ChartMonth => {
      const before = previous.data?.months[index]
      return {
        label: shortMonth(month.month),
        name: longMonth(month.month),
        value: read(month),
        compare: before ? read(before) : null,
      }
    })

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="O ano mês a mês: a sazonalidade de cada imóvel, comparada com o ano anterior."
      />
      <ReportTabs />

      <section aria-label="Ano e imóvel" className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ano anterior"
            onClick={() => {
              set({ ano: String(year - 1) })
            }}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2 className="font-wide min-w-16 text-center text-lg font-semibold" aria-live="polite">
            {year}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo ano"
            onClick={() => {
              set({ ano: String(year + 1) })
            }}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="grid gap-2">
          <label htmlFor="year-property" className="text-sm font-medium">
            Imóvel
          </label>
          <select
            id="year-property"
            value={propertyId ?? ''}
            onChange={(event) => {
              set({ imovel: event.target.value })
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-9 min-w-48 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          >
            <option value="">Todos os imóveis</option>
            {properties.data?.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
        {current.isFetching && (
          <Loader2
            className="text-muted-foreground mb-2 size-4 animate-spin"
            aria-label="Carregando"
          />
        )}
      </section>

      {current.isPending ? (
        <LoadingState />
      ) : current.isError ? (
        <ErrorState message={errorMessage(current.error)} onRetry={() => void current.refetch()} />
      ) : (
        <>
          {seasonHighlights(current.data) && (
            <p className="font-water text-muted-foreground text-sm">
              {seasonHighlights(current.data)}
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <MonthChart
              title="Receita por mês"
              year={year}
              months={chartMonths((month) => month.revenue)}
              format={formatBRL}
              axisFormat={axisBRL}
            />
            <MonthChart
              title="Ocupação por mês"
              year={year}
              months={chartMonths((month) => month.occupancyBps)}
              format={formatOccupancy}
              max={10_000}
            />
          </div>
          <YearTable report={current.data} previous={previous.data} />
        </>
      )}
    </>
  )
}

function YearTable({ report, previous }: { report: MonthlyReport; previous?: MonthlyReport }) {
  const columns: { label: string; read: (month: MonthlyReport['total']) => string }[] = [
    { label: 'Noites', read: (f) => `${String(f.nightsSold)} de ${String(f.nightsAvailable)}` },
    { label: 'Ocupação', read: (f) => formatOccupancy(f.occupancyBps) },
    { label: 'Receita', read: (f) => formatBRL(f.revenue) },
    {
      label: 'Diária média',
      read: (f) => (f.averageDailyRate === null ? '–' : formatBRL(f.averageDailyRate)),
    },
    { label: 'Líquido', read: (f) => formatBRL(f.net) },
  ]
  const lastYear = (index: number | 'total') => {
    const figures = index === 'total' ? previous?.total : previous?.months[index]
    return figures ? formatBRL(figures.revenue) : '…'
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table aria-label={`Mês a mês em ${String(report.year)}`}>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            {columns.map((column) => (
              <TableHead key={column.label} className="text-right whitespace-nowrap">
                {column.label}
              </TableHead>
            ))}
            <TableHead className="text-right whitespace-nowrap">
              Receita em {report.year - 1}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.months.map((month, index) => (
            <TableRow key={month.month}>
              <TableCell className="font-medium first-letter:uppercase">
                {longMonth(month.month)}
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column.label} className="text-right whitespace-nowrap">
                  {column.read(month)}
                </TableCell>
              ))}
              <TableCell className="text-muted-foreground text-right whitespace-nowrap">
                {lastYear(index)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">{report.year}</TableCell>
            {columns.map((column) => (
              <TableCell key={column.label} className="text-right font-semibold whitespace-nowrap">
                {column.read(report.total)}
              </TableCell>
            ))}
            <TableCell className="text-muted-foreground text-right font-semibold whitespace-nowrap">
              {lastYear('total')}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
