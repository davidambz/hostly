import type { BrokersReport, PerformanceReport, ReportFigures } from './api'

const BOM = String.fromCharCode(0xfeff)

/** Cents → `1234,56`; nothing for a figure that doesn't apply. */
const amount = (cents: number | null) =>
  cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',')

const COLUMNS: [string, (figures: ReportFigures) => string][] = [
  ['Ocupação (%)', (f) => (f.occupancyBps / 100).toFixed(2).replace('.', ',')],
  ['Noites vendidas', (f) => String(f.nightsSold)],
  ['Noites disponíveis', (f) => String(f.nightsAvailable)],
  ['Reservas', (f) => String(f.bookings)],
  ['Estadia média', (f) => (f.averageStay === null ? '' : String(f.averageStay).replace('.', ','))],
  ['Hospedagem', (f) => amount(f.lodging)],
  ['Limpeza', (f) => amount(f.cleaning)],
  ['Receita', (f) => amount(f.revenue)],
  ['Comissões', (f) => amount(f.brokerFees)],
  ['Líquido', (f) => amount(f.net)],
  ['Diária média', (f) => amount(f.averageDailyRate)],
  ['RevPAR', (f) => amount(f.revpar)],
]

const cell = (value: string) => (/[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** The report as a spreadsheet: one line per property and the total, Brazilian Excel style. */
export function performanceCsv(report: PerformanceReport): string {
  const line = (name: string, figures: ReportFigures) =>
    [cell(name), ...COLUMNS.map(([, read]) => read(figures))].join(';')
  const rows = [
    ['Imóvel', ...COLUMNS.map(([name]) => name)].join(';'),
    ...report.properties.map((property) => line(property.name, property)),
    line('Total', report.total),
  ]
  return `${BOM}${rows.join('\r\n')}\r\n`
}

/** `hostly-desempenho-2026-12-01-a-2026-12-31.csv`. */
export function performanceFileName(report: PerformanceReport, lastDay: string): string {
  return `hostly-desempenho-${report.from}-a-${lastDay}.csv`
}

const date = (value: string) => value.split('-').reverse().join('/')

/** Every commission of the period, one line per booking, to settle with each broker. */
export function commissionsCsv(report: BrokersReport): string {
  const header = [
    'Intermediador',
    'Hóspede',
    'Imóvel',
    'Entrada',
    'Saída',
    'Noites',
    'Hospedagem',
    'Comissão (%)',
    'Comissão',
  ].join(';')
  const rows = report.brokers.flatMap((broker) =>
    broker.items.map((item) =>
      [
        cell(broker.name),
        cell(item.guestName),
        cell(item.propertyName),
        date(item.checkIn),
        date(item.checkOut),
        String(item.nights),
        amount(item.lodging),
        (item.commissionBps / 100).toFixed(2).replace('.', ','),
        amount(item.fee),
      ].join(';'),
    ),
  )
  return `${BOM}${[header, ...rows].join('\r\n')}\r\n`
}
