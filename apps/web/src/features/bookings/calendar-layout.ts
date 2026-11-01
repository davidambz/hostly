/** The part of a stay that falls in one week row of the calendar. */
export interface Segment<T> {
  item: T
  /** First column (0 = Sunday) and how many day columns it covers. */
  start: number
  span: number
  /** The row inside the week; stays never overlap in the same lane. */
  lane: number
  /** The stay began in an earlier week, or goes on into a later one. */
  continuesBefore: boolean
  continuesAfter: boolean
}

interface Stay {
  checkIn: string
  checkOut: string
}

/**
 * Lays the stays out on one week (`days`, 7 `YYYY-MM-DD` strings). A stay covers its nights,
 * from check-in to the day before check-out, like an all-day event in a calendar. Longer
 * and earlier stays get the first lanes, so they keep a steady place across the week.
 */
export function layoutWeek<T extends Stay>(days: string[], stays: T[]): Segment<T>[] {
  const first = days[0]
  const last = days[days.length - 1]
  if (first === undefined || last === undefined) return []

  const segments = stays
    .filter((stay) => stay.checkIn <= last && stay.checkOut > first)
    .map((stay) => {
      const startIndex = stay.checkIn < first ? 0 : days.indexOf(stay.checkIn)
      // The last night is the day before check-out.
      const endIndex = stay.checkOut > last ? days.length - 1 : days.indexOf(stay.checkOut) - 1
      return {
        item: stay,
        start: startIndex,
        span: endIndex - startIndex + 1,
        lane: 0,
        continuesBefore: stay.checkIn < first,
        continuesAfter: stay.checkOut > addOne(last),
      }
    })
    .sort((a, b) => a.start - b.start || b.span - a.span)

  const lanesEnd: number[] = []
  for (const segment of segments) {
    let lane = lanesEnd.findIndex((end) => end < segment.start)
    if (lane === -1) lane = lanesEnd.length
    lanesEnd[lane] = segment.start + segment.span - 1
    segment.lane = lane
  }
  return segments
}

/** The day after a `YYYY-MM-DD` date, compared as text (the format sorts like dates). */
function addOne(date: string): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

/** How many stays cover each day of the week (for the "+N" of a full day). */
export function staysPerDay<T>(segments: Segment<T>[], days: number): number[] {
  const counts: number[] = Array.from({ length: days }, () => 0)
  for (const segment of segments) {
    for (let day = segment.start; day < segment.start + segment.span; day++) {
      counts[day] = (counts[day] ?? 0) + 1
    }
  }
  return counts
}
