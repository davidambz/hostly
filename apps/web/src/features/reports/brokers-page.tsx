import { Download, Users } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
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
import { addDaysISO, parseDate } from '@/features/bookings/dates'
import { useAllProperties } from '@/features/properties/api'
import { errorMessage } from '@/lib/api/form-errors'
import { downloadFile } from '@/lib/download'
import { formatBRL, formatPercent } from '@/lib/money'

import { type BrokersReport, useBrokersReport } from './api'
import { PeriodPicker } from './period-picker'
import { commissionsCsv } from './report-csv'
import { formatOccupancy } from './report-format'
import { ReportTabs } from './report-tabs'
import { usePeriodParam } from './use-period-param'

const day = (value: string) => parseDate(value).toLocaleDateString('pt-BR')

export function BrokersReportPage() {
  const [period, goTo] = usePeriodParam()
  const [params, setParams] = useSearchParams()
  const properties = useAllProperties()
  const known = properties.data?.some((property) => property.id === params.get('imovel'))
  const propertyId = known ? (params.get('imovel') ?? undefined) : undefined
  const report = useBrokersReport(period, propertyId)

  const exportCsv = () => {
    if (!report.data) return
    downloadFile(
      `hostly-comissoes-${period.from}-a-${addDaysISO(period.to, -1)}.csv`,
      commissionsCsv(report.data),
    )
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Quanto pagar a cada intermediador, e quanto rende cada canal depois da comissão."
        actions={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!report.data || report.data.brokers.length === 0}
          >
            <Download aria-hidden />
            Exportar comissões
          </Button>
        }
      />
      <ReportTabs />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PeriodPicker period={period} onChange={goTo} loading={report.isFetching} />
        <div className="grid gap-2">
          <label htmlFor="brokers-property" className="text-sm font-medium">
            Imóvel
          </label>
          <select
            id="brokers-property"
            value={propertyId ?? ''}
            onChange={(event) => {
              setParams(
                (now) => {
                  const next = new URLSearchParams(now)
                  if (event.target.value) next.set('imovel', event.target.value)
                  else next.delete('imovel')
                  return next
                },
                { replace: true },
              )
            }}
            className="border-input focus-visible:border-ring focus-visible:ring-ring dark:bg-input/30 h-9 min-w-48 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2"
          >
            <option value="">Todos os imóveis</option>
            {properties.data?.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {report.isPending ? (
        <LoadingState />
      ) : report.isError ? (
        <ErrorState message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
      ) : (
        <>
          <Commissions report={report.data} />
          <Channels report={report.data} />
        </>
      )}
    </>
  )
}

function Commissions({ report }: { report: BrokersReport }) {
  const total = report.brokers.reduce((sum, broker) => sum + broker.fees, 0)
  return (
    <section aria-labelledby="commissions-title" className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="commissions-title" className="text-sm font-semibold">
          Comissões a pagar
        </h2>
        <p className="font-water text-muted-foreground text-sm">
          Reservas com entrada no período, cada uma com a comissão inteira.
        </p>
      </div>
      {report.brokers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhuma comissão no período"
          description="Nenhuma reserva com intermediador entrou neste período."
        />
      ) : (
        <>
          <p className="font-wide text-2xl font-semibold tabular-nums">
            {formatBRL(total)}
            <span className="font-water text-muted-foreground ml-2 text-sm font-normal">
              no total
            </span>
          </p>
          {report.brokers.map((broker) => (
            <article
              key={broker.id}
              aria-labelledby={`broker-${broker.id}`}
              className="bg-card grid gap-2 rounded-md border p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id={`broker-${broker.id}`} className="font-medium">
                  {broker.name}
                </h3>
                <p className="text-sm tabular-nums">
                  <span className="text-muted-foreground">
                    {broker.bookings === 1 ? '1 reserva' : `${String(broker.bookings)} reservas`},{' '}
                    {String(broker.nights)} noites, comissão média{' '}
                    {formatPercent(broker.averageCommissionBps)} ·{' '}
                  </span>
                  <span className="font-semibold">{formatBRL(broker.fees)}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table aria-label={`Reservas de ${broker.name}`}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hóspede</TableHead>
                      <TableHead>Imóvel</TableHead>
                      <TableHead className="whitespace-nowrap">Estadia</TableHead>
                      <TableHead className="text-right">Hospedagem</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {broker.items.map((item) => (
                      <TableRow key={item.bookingId}>
                        <TableCell className="font-medium">{item.guestName}</TableCell>
                        <TableCell>{item.propertyName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {day(item.checkIn)} a {day(item.checkOut)}
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(item.lodging)}</TableCell>
                        <TableCell className="text-right">
                          {formatPercent(item.commissionBps)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatBRL(item.fee)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  )
}

function Channels({ report }: { report: BrokersReport }) {
  if (report.channels.length === 0) return null
  const totals = report.channels.reduce(
    (sum, channel) => ({
      bookings: sum.bookings + channel.bookings,
      nights: sum.nights + channel.nights,
      revenue: sum.revenue + channel.revenue,
      brokerFees: sum.brokerFees + channel.brokerFees,
      net: sum.net + channel.net,
    }),
    { bookings: 0, nights: 0, revenue: 0, brokerFees: 0, net: 0 },
  )
  return (
    <section aria-labelledby="channels-title" className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="channels-title" className="text-sm font-semibold">
          Canais
        </h2>
        <p className="font-water text-muted-foreground text-sm">
          De onde vem a receita do período, noite a noite, como no desempenho.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label="Canais">
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Reservas</TableHead>
              <TableHead className="text-right">Noites</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="min-w-40">Participação</TableHead>
              <TableHead className="text-right">Comissões</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.channels.map((channel) => (
              <TableRow key={channel.brokerId ?? 'direct'}>
                <TableCell className="font-medium">{channel.name ?? 'Reserva direta'}</TableCell>
                <TableCell className="text-right">{channel.bookings}</TableCell>
                <TableCell className="text-right">{channel.nights}</TableCell>
                <TableCell className="text-right">{formatBRL(channel.revenue)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="bg-depth-2 h-1.5 w-24 overflow-hidden rounded-full"
                      aria-hidden
                    >
                      <span
                        className="bg-primary block h-full rounded-full"
                        style={{ width: `${String(channel.shareBps / 100)}%` }}
                      />
                    </span>
                    <span className="tabular-nums">{formatOccupancy(channel.shareBps)}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatBRL(channel.brokerFees)}</TableCell>
                <TableCell className="text-right font-medium">{formatBRL(channel.net)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {report.channels.length > 1 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">{totals.bookings}</TableCell>
                <TableCell className="text-right font-semibold">{totals.nights}</TableCell>
                <TableCell className="text-right font-semibold">
                  {formatBRL(totals.revenue)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold">
                  {formatBRL(totals.brokerFees)}
                </TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.net)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </section>
  )
}
