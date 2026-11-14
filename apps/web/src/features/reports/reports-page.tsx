import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  Loader2,
} from 'lucide-react'
import { useId } from 'react'
import { Link, useSearchParams } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { addDaysISO, todayISO } from '@/features/bookings/dates'
import { downloadFile } from '@/features/bookings/export-csv'
import { colorOf, propertyColors } from '@/features/bookings/property-colors'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/utils'

import { type PerformanceReport, type ReportFigures, usePerformance } from './api'
import {
  customPeriod,
  lastYearOf,
  MAX_PERIOD_DAYS,
  type Period,
  PERIOD_KINDS,
  type PeriodKind,
  periodDays,
  periodFromSearch,
  periodLabel,
  periodOf,
  periodSearch,
  shiftPeriod,
} from './period'
import { performanceCsv, performanceFileName } from './report-csv'
import { ReportTabs } from './report-tabs'
import { change, formatOccupancy, formatStay } from './report-format'

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const period = periodFromSearch(params)
  const current = usePerformance(period)
  const previous = usePerformance(shiftPeriod(period, -1))
  const lastYear = usePerformance(lastYearOf(period))

  const goTo = (next: Period) => {
    setParams(
      () => {
        const search = new URLSearchParams()
        for (const [name, value] of Object.entries(periodSearch(next))) {
          if (value) search.set(name, value)
        }
        return search
      },
      { replace: true },
    )
  }

  const report = current.data
  const exportCsv = () => {
    if (!report) return
    downloadFile(performanceFileName(report, addDaysISO(report.to, -1)), performanceCsv(report))
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Como cada imóvel foi no período, comparado com o anterior e com o ano passado."
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!report || report.properties.length === 0}
          >
            <Download aria-hidden />
            Exportar planilha
          </Button>
        }
      />

      <ReportTabs />

      <PeriodPicker period={period} onChange={goTo} loading={current.isFetching} />

      {current.isPending ? (
        <LoadingState />
      ) : current.isError ? (
        <ErrorState message={errorMessage(current.error)} onRetry={() => void current.refetch()} />
      ) : current.data.properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Nenhum imóvel ainda"
          description="Os relatórios mostram como cada imóvel vai: cadastre o primeiro para começar."
          action={
            <Button asChild>
              <Link to="/imoveis">Cadastrar imóvel</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Totals
            report={current.data}
            previous={previous.data?.total}
            lastYear={lastYear.data?.total}
          />
          <PropertiesTable report={current.data} />
        </>
      )}
    </>
  )
}

function PeriodPicker({
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

const FIGURES: {
  label: string
  value: (figures: ReportFigures) => number | null
  format: (value: number) => string
  /** Occupancy changes in percentage points, money in percent. */
  points?: boolean
}[] = [
  { label: 'Receita', value: (f) => f.revenue, format: formatBRL },
  { label: 'Líquido', value: (f) => f.net, format: formatBRL },
  { label: 'Ocupação', value: (f) => f.occupancyBps, format: formatOccupancy, points: true },
  { label: 'Diária média', value: (f) => f.averageDailyRate, format: formatBRL },
  { label: 'RevPAR', value: (f) => f.revpar, format: formatBRL },
]

/** The period's totals, each with how it moved since the previous period and last year. */
function Totals({
  report,
  previous,
  lastYear,
}: {
  report: PerformanceReport
  previous?: ReportFigures
  lastYear?: ReportFigures
}) {
  return (
    <section aria-labelledby="totals-title" className="grid gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="totals-title" className="text-sm font-semibold">
          Todos os imóveis
        </h2>
        <p className="font-water text-muted-foreground text-sm">
          {report.total.nightsSold} de {report.total.nightsAvailable} noites vendidas,{' '}
          {report.total.bookings === 1 ? '1 reserva' : `${String(report.total.bookings)} reservas`}{' '}
          com entrada no período.
        </p>
      </div>
      <dl className="bg-grid-line grid grid-cols-2 gap-px overflow-hidden rounded-md border sm:grid-cols-3 lg:grid-cols-5">
        {FIGURES.map((figure) => {
          const value = figure.value(report.total)
          return (
            <div key={figure.label} className="bg-card grid content-start gap-1 p-3">
              <dt className="text-muted-foreground text-sm">{figure.label}</dt>
              <dd className="font-wide text-xl leading-tight font-semibold tabular-nums">
                {value === null ? '–' : figure.format(value)}
              </dd>
              <dd className="grid gap-0.5">
                <Change
                  label="vs. período anterior"
                  now={value}
                  before={previous ? figure.value(previous) : undefined}
                  points={figure.points}
                />
                <Change
                  label="vs. ano passado"
                  now={value}
                  before={lastYear ? figure.value(lastYear) : undefined}
                  points={figure.points}
                />
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function Change({
  label,
  now,
  before,
  points,
}: {
  label: string
  now: number | null
  before: number | null | undefined
  points?: boolean
}) {
  const moved = before === undefined ? undefined : change(now, before, points)
  return (
    <span className="font-water text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
      {moved?.direction === 'up' && <ArrowUpRight className="text-primary size-3.5" aria-hidden />}
      {moved?.direction === 'down' && (
        <ArrowDownRight className="text-destructive size-3.5" aria-hidden />
      )}
      <span>
        {moved === undefined ? '…' : moved.text} {label}
      </span>
    </span>
  )
}

function PropertiesTable({ report }: { report: PerformanceReport }) {
  const colors = propertyColors(report.properties.map((property) => property.id))
  const columns: { label: string; read: (f: ReportFigures) => string }[] = [
    { label: 'Ocupação', read: (f) => formatOccupancy(f.occupancyBps) },
    { label: 'Noites', read: (f) => `${String(f.nightsSold)} de ${String(f.nightsAvailable)}` },
    { label: 'Reservas', read: (f) => String(f.bookings) },
    { label: 'Estadia média', read: (f) => formatStay(f.averageStay) },
    { label: 'Receita', read: (f) => formatBRL(f.revenue) },
    { label: 'Comissões', read: (f) => formatBRL(f.brokerFees) },
    { label: 'Líquido', read: (f) => formatBRL(f.net) },
    {
      label: 'Diária média',
      read: (f) => (f.averageDailyRate === null ? '–' : formatBRL(f.averageDailyRate)),
    },
    { label: 'RevPAR', read: (f) => formatBRL(f.revpar) },
  ]

  return (
    <section aria-labelledby="by-property-title" className="grid gap-2">
      <h2 id="by-property-title" className="text-sm font-semibold">
        Por imóvel
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label="Desempenho por imóvel">
          <TableHeader>
            <TableRow>
              <TableHead>Imóvel</TableHead>
              {columns.map((column) => (
                <TableHead key={column.label} className="text-right whitespace-nowrap">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        colorOf(colors, property.id).dot,
                      )}
                      aria-hidden
                    />
                    {property.name}
                  </span>
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.label} className="text-right whitespace-nowrap">
                    {column.read(property)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          {report.properties.length > 1 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={column.label}
                    className="text-right font-semibold whitespace-nowrap"
                  >
                    {column.read(report.total)}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      <p className="font-water text-muted-foreground text-xs">
        Reservas que atravessam o período contam só as noites dentro dele, com a hospedagem e a
        comissão divididas por noite; a limpeza conta no dia da entrada. Diária média: hospedagem
        por noite vendida. RevPAR: hospedagem por noite disponível.
      </p>
    </section>
  )
}
