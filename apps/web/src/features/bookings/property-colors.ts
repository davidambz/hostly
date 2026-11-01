/**
 * Colors that tell properties apart on the calendar, readable with white or dark text in
 * both themes. Assigned by the property's place in the (name-sorted) list, so a property
 * keeps its color between visits.
 */
const COLORS = [
  { bar: 'bg-sky-600 text-white hover:bg-sky-700', dot: 'bg-sky-600' },
  { bar: 'bg-emerald-600 text-white hover:bg-emerald-700', dot: 'bg-emerald-600' },
  { bar: 'bg-amber-400 text-amber-950 hover:bg-amber-500', dot: 'bg-amber-400' },
  { bar: 'bg-rose-600 text-white hover:bg-rose-700', dot: 'bg-rose-600' },
  { bar: 'bg-violet-600 text-white hover:bg-violet-700', dot: 'bg-violet-600' },
  { bar: 'bg-teal-600 text-white hover:bg-teal-700', dot: 'bg-teal-600' },
  { bar: 'bg-orange-500 text-orange-950 hover:bg-orange-600', dot: 'bg-orange-500' },
  { bar: 'bg-indigo-600 text-white hover:bg-indigo-700', dot: 'bg-indigo-600' },
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
