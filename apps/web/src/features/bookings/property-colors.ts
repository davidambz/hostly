/**
 * Colors that tell properties apart on the calendar: the `--property-N` theme tokens (see
 * globals.css), each with a light and a dark version and readable text on it. Assigned by
 * the property's place in the (name-sorted) list, so a property keeps its color.
 *
 * Whole class names, so Tailwind finds them in the source.
 */
const COLORS = [
  {
    bar: 'bg-property-1 text-property-1-foreground hover:bg-property-1/85',
    dot: 'bg-property-1',
  },
  {
    bar: 'bg-property-2 text-property-2-foreground hover:bg-property-2/85',
    dot: 'bg-property-2',
  },
  {
    bar: 'bg-property-3 text-property-3-foreground hover:bg-property-3/85',
    dot: 'bg-property-3',
  },
  {
    bar: 'bg-property-4 text-property-4-foreground hover:bg-property-4/85',
    dot: 'bg-property-4',
  },
  {
    bar: 'bg-property-5 text-property-5-foreground hover:bg-property-5/85',
    dot: 'bg-property-5',
  },
  {
    bar: 'bg-property-6 text-property-6-foreground hover:bg-property-6/85',
    dot: 'bg-property-6',
  },
  {
    bar: 'bg-property-7 text-property-7-foreground hover:bg-property-7/85',
    dot: 'bg-property-7',
  },
  {
    bar: 'bg-property-8 text-property-8-foreground hover:bg-property-8/85',
    dot: 'bg-property-8',
  },
] as const

export type PropertyColor = (typeof COLORS)[number]

const FALLBACK = COLORS[0]

/** The color of each property id, in the order the properties are listed. */
export function propertyColors(propertyIds: string[]): Map<string, PropertyColor> {
  return new Map(propertyIds.map((id, index) => [id, COLORS[index % COLORS.length] ?? FALLBACK]))
}

export function colorOf(colors: Map<string, PropertyColor>, propertyId: string): PropertyColor {
  return colors.get(propertyId) ?? FALLBACK
}
