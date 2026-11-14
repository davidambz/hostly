import { useEffect, useRef, useState } from 'react'

import { niceTicks } from './report-format'

export interface ChartMonth {
  /** `jan`, `fev`… */
  label: string
  /** `janeiro`… for the tooltip. */
  name: string
  value: number
  /** Last year's value, drawn as a tick (none at zero: the table has it). */
  compare: number | null
}

/** The width drawn before the container is measured (and in tests, where nothing is). */
const DEFAULT_WIDTH = 720
const HEIGHT = 220
const PAD = { top: 12, right: 8, bottom: 32, left: 76 }
/** Columns are at most this wide, and at most 60% of their slot on a narrow chart. */
const MAX_BAR = 24
const RADIUS = 4

/** A column with a rounded top and a square foot on the baseline. */
function column(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, height, width / 2)
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
}

/**
 * The element's width in CSS pixels, kept up to date: the chart is drawn at its real size,
 * so its text stays legible on a phone instead of shrinking with the drawing.
 */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry?.contentRect.width ?? 0)
      if (measured > 0) setWidth(measured)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  return [ref, width] as const
}

/**
 * Twelve months as columns (this year, the primary blue) with last year as an amber tick
 * over each one. One measure, one axis. Hovering a month shows both values; the table
 * below the chart holds every number for anyone who can't see it.
 */
export function MonthChart({
  title,
  months,
  year,
  format,
  axisFormat = format,
  max,
}: {
  title: string
  months: ChartMonth[]
  year: number
  format: (value: number) => string
  axisFormat?: (value: number) => string
  /** A fixed axis top (e.g. 100% occupancy); otherwise a clean value above the data. */
  max?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [frame, WIDTH] = useWidth()
  const ticks = max
    ? [0, 0.25, 0.5, 0.75, 1].map((share) => share * max)
    : niceTicks(Math.max(...months.flatMap((month) => [month.value, month.compare ?? 0])))
  const top = ticks.at(-1) ?? 1
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const slot = plotWidth / months.length
  const BAR = Math.min(MAX_BAR, Math.max(6, Math.round(slot * 0.6)))
  const y = (value: number) => PAD.top + plotHeight - (Math.min(value, top) / top) * plotHeight
  const hovered = hover === null ? undefined : months[hover]
  const hasCompare = months.some((month) => (month.compare ?? 0) > 0)

  return (
    <figure className="bg-card grid min-w-0 gap-3 rounded-md border p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold">{title}</span>
        {hasCompare && (
          <span className="text-muted-foreground flex items-center gap-3 text-xs" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="bg-primary size-2.5 rounded-[2px]" />
              {year}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bg-chart-compare h-0.5 w-3 rounded-full" />
              {year - 1}
            </span>
          </span>
        )}
      </figcaption>
      <div ref={frame} className="relative min-w-0">
        <svg
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          width={WIDTH}
          height={HEIGHT}
          className="block h-auto max-w-full overflow-visible"
          role="img"
          aria-label={`${title}, ${String(year)}. Os valores estão na tabela abaixo.`}
          onMouseLeave={() => {
            setHover(null)
          }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-grid-line"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[12px] tabular-nums"
              >
                {axisFormat(tick)}
              </text>
            </g>
          ))}
          {months.map((month, index) => {
            const x = PAD.left + index * slot + (slot - BAR) / 2
            const height = PAD.top + plotHeight - y(month.value)
            return (
              <g key={month.label}>
                {height > 0 && (
                  <path
                    d={column(x, y(month.value), BAR, height)}
                    className={
                      hover === null || hover === index ? 'fill-primary' : 'fill-primary/45'
                    }
                  />
                )}
                {month.compare !== null && month.compare > 0 && (
                  <line
                    x1={x - 4}
                    x2={x + BAR + 4}
                    y1={y(month.compare)}
                    y2={y(month.compare)}
                    className="stroke-chart-compare"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )}
                {/* Narrow: every other month's name, so they never touch. */}
                {(slot >= 28 || index % 2 === 0) && (
                  <text
                    x={x + BAR / 2}
                    y={HEIGHT - 10}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {month.label}
                  </text>
                )}
                {/* The whole slot answers the pointer, bigger than the column. */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => {
                    setHover(index)
                  }}
                />
              </g>
            )
          })}
        </svg>
        {hovered && hover !== null && (
          <div
            role="status"
            className="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 grid min-w-36 gap-1 rounded-md border p-2 text-xs shadow-md"
            style={{
              left: `${String(((PAD.left + (hover + 0.5) * slot) / WIDTH) * 100)}%`,
              transform: hover > 7 ? 'translateX(-100%)' : 'translateX(8px)',
            }}
          >
            <span className="font-medium first-letter:uppercase">{hovered.name}</span>
            <span className="flex items-center justify-between gap-3 tabular-nums">
              <span className="flex items-center gap-1.5">
                <span className="bg-primary size-2 rounded-[2px]" aria-hidden />
                {year}
              </span>
              {format(hovered.value)}
            </span>
            {hovered.compare !== null && (
              <span className="flex items-center justify-between gap-3 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <span className="bg-chart-compare h-0.5 w-2.5 rounded-full" aria-hidden />
                  {year - 1}
                </span>
                {format(hovered.compare)}
              </span>
            )}
          </div>
        )}
      </div>
    </figure>
  )
}
