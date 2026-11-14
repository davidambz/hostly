import { useState } from 'react'

import { cn } from '@/lib/utils'

import { type Depth, depthOf } from '../bookings/occupancy'

/** A demo property: its name and the property color slot it is drawn in. */
interface ChartProperty {
  name: string
  ink: 1 | 2 | 3 | 5
}

/** A demo stay, in January 2027 day numbers (December days are ≤ 0, February ≥ 32). */
interface ChartStay {
  property: number
  guest: string
  /** First night. */
  from: number
  /** Check-out day: the night before it is the last one. */
  to: number
}

// The same names and colors as the app screens further down the page, so the page teaches
// one color key.
const PROPERTIES: ChartProperty[] = [
  { name: 'Casa da Praia', ink: 2 },
  { name: 'Apartamento 302', ink: 1 },
  { name: 'Chalé da Lagoa', ink: 3 },
]

const STAYS: ChartStay[] = [
  { property: 0, guest: 'Ana Ribeiro', from: -5, to: 3 },
  { property: 0, guest: 'Carlos Menezes', from: 5, to: 12 },
  { property: 0, guest: 'Fernanda Lima', from: 15, to: 25 },
  { property: 1, guest: 'Rafael Oliveira', from: 2, to: 9 },
  { property: 1, guest: 'Juliana Prado', from: 10, to: 17 },
  { property: 1, guest: 'Bruno Tavares', from: 20, to: 31 },
  { property: 2, guest: 'Luiza Fernandes', from: 3, to: 8 },
  { property: 2, guest: 'Pedro Almeida', from: 12, to: 19 },
  { property: 2, guest: 'Camila Duarte', from: 22, to: 28 },
]

/** The visitor's property: a first stay on free January nights, in its own lane. */
const VISITOR = { ink: 5 as const, from: 25, to: 31 }

/** January 2027 starts on a Friday: the chart opens on Sunday 27 December. */
const FIRST_DAY = -4
const WEEKS = 6
const JANUARY_DAYS = 31
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const INK: Record<ChartProperty['ink'], string> = {
  1: 'bg-property-1 text-property-1-foreground',
  2: 'bg-property-2 text-property-2-foreground',
  3: 'bg-property-3 text-property-3-foreground',
  5: 'bg-property-5 text-property-5-foreground',
}

const DOT: Record<ChartProperty['ink'], string> = {
  1: 'bg-property-1',
  2: 'bg-property-2',
  3: 'bg-property-3',
  5: 'bg-property-5',
}

const DEPTH: Record<Depth, string> = {
  1: 'bg-depth-1 text-depth-1-foreground',
  2: 'bg-depth-2 text-depth-2-foreground',
  3: 'bg-depth-3 text-depth-3-foreground',
  4: 'bg-depth-4 text-depth-4-foreground',
  5: 'bg-depth-5 text-depth-5-foreground',
  6: 'bg-depth-6 text-depth-6-foreground',
}

function dayLabel(day: number) {
  return day < 1 ? day + JANUARY_DAYS : day > JANUARY_DAYS ? day - JANUARY_DAYS : day
}

/** January nights of a stay. */
function januaryNights({ from, to }: { from: number; to: number }) {
  return Math.max(0, Math.min(to, JANUARY_DAYS + 1) - Math.max(from, 1))
}

/** Splits a stay into one band per week row it crosses. */
function segments(from: number, to: number) {
  const parts: { week: number; start: number; span: number; first: boolean }[] = []
  for (let night = from; night < to;) {
    const index = night - FIRST_DAY
    const week = Math.floor(index / 7)
    if (week >= WEEKS) break
    const start = index % 7
    const end = Math.min(to - FIRST_DAY, (week + 1) * 7)
    if (week >= 0) parts.push({ week, start, span: end - index, first: night === from })
    night = end + FIRST_DAY
  }
  return parts
}

/**
 * January read like a chart: the month's nights over faint contour lines, every stay traced
 * across them in its property's color, and above, each property's soundings (its January
 * nights, the water as deep as it is full). Hovering or focusing a sounding lights up that
 * property's stays. `visitorName` joins the chart as a first stay on the free nights.
 */
export function SeasonChart({ visitorName }: { visitorName: string }) {
  const [focus, setFocus] = useState<number | null>(null)
  const visitorLane = PROPERTIES.length
  const name = visitorName.trim()

  const lit = (lane: number) => focus === null || focus === lane
  const soundings = [
    ...PROPERTIES.map((property, lane) => ({
      ...property,
      nights: STAYS.filter((stay) => stay.property === lane).reduce(
        (sum, stay) => sum + januaryNights(stay),
        0,
      ),
    })),
    { name: name || 'Seu imóvel', ink: VISITOR.ink, nights: name ? januaryNights(VISITOR) : 0 },
  ]

  return (
    <figure className="bg-grid-line flex h-full flex-col gap-px p-px">
      <figcaption>
        <ul aria-label="Imóveis do exemplo" className="grid grid-cols-2 gap-px sm:grid-cols-4">
          {soundings.map((property, lane) => (
            <li
              key={lane === visitorLane ? `visitor-${String(Boolean(name))}` : lane}
              className="flex"
            >
              <button
                type="button"
                aria-pressed={focus === lane}
                aria-label={`${property.name}: ${String(property.nights)} noites em janeiro`}
                onPointerEnter={() => {
                  setFocus(lane)
                }}
                onPointerLeave={() => {
                  setFocus(null)
                }}
                onFocus={() => {
                  setFocus(lane)
                }}
                onBlur={() => {
                  setFocus(null)
                }}
                style={{ animationDelay: `${String(300 + lane * 90)}ms` }}
                className={cn(
                  'animate-tide focus-visible:ring-ring flex w-full flex-col gap-2 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset',
                  DEPTH[depthOf(property.nights, JANUARY_DAYS)],
                  // On a phone this cell is the part of the chart in view while typing.
                  lane === visitorLane && name && 'ring-property-5 ring-2 ring-inset',
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-[2px] ring-2 ring-card',
                      DOT[property.ink],
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{property.name}</span>
                </span>
                <span className="flex items-baseline gap-1.5" aria-hidden>
                  <span className="font-wide text-2xl leading-none font-semibold tabular-nums">
                    {property.nights}
                  </span>
                  <span className="font-water text-xs opacity-80">noites</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </figcaption>

      <div
        role="img"
        aria-label={`Exemplo de calendário de janeiro com as estadias de ${String(PROPERTIES.length)} imóveis${
          name ? ` e de ${name}` : ''
        }, cada imóvel numa cor, sem noites em dobro.`}
        className="relative grid flex-1 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-px"
      >
        <div className="grid grid-cols-7 gap-px" aria-hidden>
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              className="bg-card text-muted-foreground py-1 text-center text-xs font-medium tracking-wide uppercase"
            >
              {weekday}
            </span>
          ))}
        </div>
        {Array.from({ length: WEEKS }, (_, week) => (
          <div key={week} className="relative grid min-h-[5.75rem] grid-cols-7 gap-px" aria-hidden>
            {Array.from({ length: 7 }, (_, column) => {
              const day = FIRST_DAY + week * 7 + column
              const january = day >= 1 && day <= JANUARY_DAYS
              return (
                <div
                  key={column}
                  style={{ animationDelay: `${String((week + column) * 45)}ms` }}
                  // January's nights are chart water; other months' days are shoal and recede.
                  className={cn('animate-surface p-1.5', january ? 'chart-water' : 'bg-shoal')}
                >
                  <span
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      january ? 'text-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {dayLabel(day)}
                  </span>
                </div>
              )
            })}
            {STAYS.flatMap((stay, index) =>
              segments(stay.from, stay.to)
                .filter((part) => part.week === week)
                .map((part) => (
                  <Band
                    key={`${String(index)}-${String(part.start)}`}
                    lane={stay.property}
                    start={part.start}
                    span={part.span}
                    ink={PROPERTIES[stay.property]?.ink ?? 1}
                    label={part.first || part.start === 0 ? stay.guest : ''}
                    delay={600 + index * 110}
                    dim={!lit(stay.property)}
                  />
                )),
            )}
            {name &&
              segments(VISITOR.from, VISITOR.to)
                .filter((part) => part.week === week)
                .map((part) => (
                  <Band
                    // Traced again whenever the name changes.
                    key={name}
                    lane={visitorLane}
                    start={part.start}
                    span={part.span}
                    ink={VISITOR.ink}
                    label={`${name} · sua 1ª reserva`}
                    delay={0}
                    dim={!lit(visitorLane)}
                  />
                ))}
          </div>
        ))}
      </div>
    </figure>
  )
}

function Band({
  lane,
  start,
  span,
  ink,
  label,
  delay,
  dim,
}: {
  lane: number
  start: number
  span: number
  ink: ChartProperty['ink']
  label: string
  delay: number
  dim: boolean
}) {
  return (
    <span
      style={{
        left: `calc((100% - 6px) / 7 * ${String(start)} + ${String(start + 3)}px)`,
        width: `calc((100% - 6px) / 7 * ${String(span)} + ${String(span - 1 - 6)}px)`,
        top: `calc(1.6rem + ${String(lane)} * 1.05rem)`,
        animationDelay: `${String(delay)}ms`,
      }}
      className={cn(
        'animate-trace absolute h-[0.9rem] truncate rounded-[3px] px-1.5 text-xs leading-[0.9rem] font-semibold transition-opacity duration-300',
        INK[ink],
        dim && 'opacity-20',
      )}
    >
      {label}
    </span>
  )
}
