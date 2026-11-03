import { useState } from 'react'

import { cn } from '@/lib/utils'

/** A demo property: its name and the glaze (property color slot) it is painted in. */
interface WallProperty {
  name: string
  glaze: 1 | 2 | 3 | 5
}

/** A demo stay, in January 2027 day numbers (December days are negative: 27 Dec = -4). */
interface WallStay {
  property: number
  guest: string
  /** First night. */
  from: number
  /** Check-out day: the night before it is the last one. */
  to: number
}

const PROPERTIES: WallProperty[] = [
  { name: 'Casa da Praia', glaze: 1 },
  { name: 'Apartamento Centro', glaze: 2 },
  { name: 'Chalé da Lagoa', glaze: 3 },
]

const STAYS: WallStay[] = [
  { property: 0, guest: 'Ana Ribeiro', from: -5, to: 3 },
  { property: 0, guest: 'Carlos Menezes', from: 5, to: 12 },
  { property: 0, guest: 'Fernanda Lima', from: 15, to: 25 },
  { property: 1, guest: 'Rafael Oliveira', from: 2, to: 9 },
  { property: 1, guest: 'Juliana Prado', from: 10, to: 17 },
  { property: 1, guest: 'Bruno Tavares', from: 20, to: 30 },
  { property: 2, guest: 'Luiza Fernandes', from: 3, to: 8 },
  { property: 2, guest: 'Pedro Almeida', from: 12, to: 19 },
  { property: 2, guest: 'Camila Duarte', from: 22, to: 28 },
]

/** The visitor's own property gets the fourth lane, with a first stay on free nights. */
const VISITOR = { glaze: 5 as const, from: 24, to: 30 }

/** January 2027 starts on a Friday: the wall opens on Sunday 27 December. */
const FIRST_DAY = -4
const WEEKS = 5
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const GLAZE: Record<WallProperty['glaze'], string> = {
  1: 'bg-property-1 text-property-1-foreground',
  2: 'bg-property-2 text-property-2-foreground',
  3: 'bg-property-3 text-property-3-foreground',
  5: 'bg-property-5 text-property-5-foreground',
}

const DOT: Record<WallProperty['glaze'], string> = {
  1: 'bg-property-1',
  2: 'bg-property-2',
  3: 'bg-property-3',
  5: 'bg-property-5',
}

function dayLabel(day: number) {
  return day < 1 ? day + 31 : day > 31 ? day - 31 : day
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
 * January as a wall of tiles: every night a tile, every stay a band painted across them,
 * every property a glaze. Hovering or focusing a property in the legend lights up its stays.
 * `visitorName` paints the visitor's own property in as a fourth lane.
 */
export function TileWall({ visitorName }: { visitorName: string }) {
  const [focus, setFocus] = useState<number | null>(null)
  const visitorLane = PROPERTIES.length
  const name = visitorName.trim()

  const lit = (lane: number) => focus === null || focus === lane

  return (
    <figure className="flex h-full flex-col gap-4">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-muted-foreground">Cada cor é um imóvel:</span>
        <ul aria-label="Imóveis do exemplo" className="flex flex-wrap gap-x-1 gap-y-1">
          {[...PROPERTIES, { name: name || 'Seu imóvel', glaze: VISITOR.glaze }].map(
            (property, lane) => (
              <li key={lane}>
                <button
                  type="button"
                  aria-pressed={focus === lane}
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
                  className={cn(
                    'hover:bg-accent focus-visible:ring-ring flex items-center gap-1.5 rounded-sm px-2 py-1 outline-none focus-visible:ring-2',
                    lane === visitorLane && !name && 'text-muted-foreground italic',
                  )}
                >
                  <span className={cn('size-2.5 rounded-[2px]', DOT[property.glaze])} aria-hidden />
                  {property.name}
                </button>
              </li>
            ),
          )}
        </ul>
      </figcaption>

      <div
        role="img"
        aria-label={`Exemplo de calendário de janeiro com as estadias de ${PROPERTIES.length} imóveis${
          name ? ` e de ${name}` : ''
        }, cada imóvel numa cor, sem noites em dobro.`}
        className="bg-grout grid flex-1 grid-rows-[auto_repeat(5,minmax(0,1fr))] gap-[3px] rounded-md p-[3px]"
      >
        <div className="grid grid-cols-7 gap-[3px]" aria-hidden>
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              className="bg-card text-muted-foreground rounded-[2px] py-1 text-center text-xs font-medium tracking-wide uppercase"
            >
              {weekday}
            </span>
          ))}
        </div>
        {Array.from({ length: WEEKS }, (_, week) => (
          <div
            key={week}
            className="relative grid min-h-[5.5rem] grid-cols-7 gap-[3px]"
            aria-hidden
          >
            {Array.from({ length: 7 }, (_, column) => {
              const day = FIRST_DAY + week * 7 + column
              return (
                <div
                  key={column}
                  style={{ animationDelay: `${(week + column) * 45}ms` }}
                  className={cn(
                    'azulejo animate-tile-settle rounded-[2px] p-1.5',
                    day < 1 && '[--tile-ink:var(--glaze-strong)] opacity-70',
                  )}
                >
                  <span className="font-display text-foreground/80 text-sm">{dayLabel(day)}</span>
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
                    glaze={PROPERTIES[stay.property]?.glaze ?? 1}
                    label={part.first || part.start === 0 ? stay.guest : ''}
                    delay={600 + index * 110}
                    dim={!lit(stay.property)}
                  />
                )),
            )}
            {segments(VISITOR.from, VISITOR.to)
              .filter((part) => part.week === week)
              .map((part) => (
                <Band
                  // Repainted when the visitor starts typing a name.
                  key={name ? 'named' : 'empty'}
                  lane={visitorLane}
                  start={part.start}
                  span={part.span}
                  glaze={VISITOR.glaze}
                  label={name ? `${name} · sua 1ª reserva` : 'seu imóvel aqui'}
                  delay={name ? 0 : 1700}
                  dim={!lit(visitorLane)}
                  outline={!name}
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
  glaze,
  label,
  delay,
  dim,
  outline = false,
}: {
  lane: number
  start: number
  span: number
  glaze: WallProperty['glaze']
  label: string
  delay: number
  dim: boolean
  outline?: boolean
}) {
  return (
    <span
      style={{
        left: `calc(${String((start / 7) * 100)}% + 4px)`,
        width: `calc(${String((span / 7) * 100)}% - 8px)`,
        top: `calc(1.6rem + ${String(lane)} * 1.05rem)`,
        animationDelay: `${String(delay)}ms`,
      }}
      className={cn(
        'animate-paint absolute h-[0.9rem] truncate rounded-[3px] px-1.5 text-[0.7rem] leading-[0.9rem] font-semibold transition-opacity duration-300',
        outline
          ? 'border-property-5 text-muted-foreground border border-dashed bg-transparent'
          : GLAZE[glaze],
        dim && 'opacity-20',
      )}
    >
      {label}
    </span>
  )
}
