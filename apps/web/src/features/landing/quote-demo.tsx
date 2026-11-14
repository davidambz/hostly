import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/money'

const NIGHTLY = [250, 350, 450, 600, 800]
const COMMISSION = [0, 8, 10, 15]

/**
 * The booking summary, working: the same math as the app's (commission over the nights,
 * not the cleaning fee), on a stay the visitor shapes with a few taps.
 */
export function QuoteDemo() {
  const [nights, setNights] = useState(7)
  const [nightly, setNightly] = useState(450)
  const [commission, setCommission] = useState(10)
  const [paid, setPaid] = useState(true)
  const id = useId()

  const cleaning = 180
  const lodging = nights * nightly * 100
  const total = lodging + cleaning * 100
  const fee = Math.round((lodging * commission) / 100)
  const deposit = paid ? Math.round(total / 2 / 100) * 100 : 0

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-5">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Noites</legend>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Uma noite a menos"
              disabled={nights <= 1}
              onClick={() => {
                setNights((value) => value - 1)
              }}
            >
              <Minus aria-hidden />
            </Button>
            <output
              aria-live="polite"
              className="font-wide w-12 text-center text-3xl font-semibold tabular-nums"
            >
              {nights}
            </output>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Uma noite a mais"
              disabled={nights >= 30}
              onClick={() => {
                setNights((value) => value + 1)
              }}
            >
              <Plus aria-hidden />
            </Button>
          </div>
        </fieldset>
        <Choice
          legend="Diária"
          name={`${id}-nightly`}
          options={NIGHTLY}
          value={nightly}
          format={(value) => formatBRL(value * 100).replace(',00', '')}
          onChange={setNightly}
        />
        <Choice
          legend="Comissão do intermediador"
          name={`${id}-commission`}
          options={COMMISSION}
          value={commission}
          format={(value) => (value === 0 ? 'Direto' : `${String(value)}%`)}
          onChange={setCommission}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paid}
            onChange={(event) => {
              setPaid(event.target.checked)
            }}
            className="accent-primary size-4"
          />
          O hóspede pagou metade de sinal
        </label>
      </div>

      <dl className="bg-card relative grid content-start gap-0 overflow-hidden rounded-md border p-1">
        <div className="bg-card grid gap-2 rounded-[3px] p-5">
          <Line label={`${String(nights)} noites × ${formatBRL(nightly * 100)}`} value={lodging} />
          <Line label="Limpeza" value={cleaning * 100} />
          <Line label="Total do hóspede" value={total} strong />
          {commission > 0 && (
            <Line label={`Comissão (${String(commission)}% das diárias)`} value={-fee} muted />
          )}
          <Line label="Você recebe" value={total - fee} strong />
          <div className="border-border my-1 border-t" />
          <Line label="Já pago" value={deposit} muted />
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-medium">Falta receber</dt>
            <dd
              key={total - deposit}
              className="font-wide animate-surface text-primary text-2xl font-semibold tabular-nums"
            >
              {total - deposit === 0 ? 'Quitado' : formatBRL(total - deposit)}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  )
}

function Choice({
  legend,
  name,
  options,
  value,
  format,
  onChange,
}: {
  legend: string
  name: string
  options: number[]
  value: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option}
            className="has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary has-[:focus-visible]:ring-ring hover:bg-accent cursor-pointer rounded-sm border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors has-[:focus-visible]:ring-2"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option}
              onChange={() => {
                onChange(option)
              }}
            />
            {format(option)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Line({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string
  value: number
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={
        muted ? 'text-muted-foreground flex justify-between gap-4' : 'flex justify-between gap-4'
      }
    >
      <dt className={strong ? 'font-semibold' : undefined}>{label}</dt>
      <dd className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>
        {value < 0 ? `− ${formatBRL(-value)}` : formatBRL(value)}
      </dd>
    </div>
  )
}
