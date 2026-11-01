import { describe, expect, it } from 'vitest'

import { layoutWeek, staysPerDay } from './calendar-layout'
import { weekDays } from './dates'

// Sunday Nov 8 to Saturday Nov 14, 2026
const week = weekDays('2026-11-10')

const stay = (id: string, checkIn: string, checkOut: string) => ({ id, checkIn, checkOut })

describe('layoutWeek', () => {
  it('covers the nights: from check-in to the day before check-out', () => {
    const [segment] = layoutWeek(week, [stay('a', '2026-11-09', '2026-11-12')])

    expect(segment).toMatchObject({
      start: 1,
      span: 3,
      lane: 0,
      continuesBefore: false,
      continuesAfter: false,
    })
  })

  it('cuts stays at the edges of the week and says they go on', () => {
    const [segment] = layoutWeek(week, [stay('a', '2026-11-01', '2026-11-20')])

    expect(segment).toMatchObject({
      start: 0,
      span: 7,
      continuesBefore: true,
      continuesAfter: true,
    })
  })

  it('ends at Saturday, without going on, when check-out is the next Sunday', () => {
    const [segment] = layoutWeek(week, [stay('a', '2026-11-13', '2026-11-15')])

    expect(segment).toMatchObject({ start: 5, span: 2, continuesAfter: false })
  })

  it('leaves out stays of other weeks, and those that check out on the first day', () => {
    const segments = layoutWeek(week, [
      stay('before', '2026-11-01', '2026-11-08'),
      stay('after', '2026-11-15', '2026-11-18'),
    ])

    expect(segments).toEqual([])
  })

  it('stacks overlapping stays and reuses a lane once it is free', () => {
    const segments = layoutWeek(week, [
      stay('a', '2026-11-08', '2026-11-11'),
      stay('b', '2026-11-09', '2026-11-13'),
      // checks in on the day "a" checks out: same lane as "a"
      stay('c', '2026-11-11', '2026-11-12'),
    ])
    const lanes = Object.fromEntries(segments.map((s) => [s.item.id, s.lane]))

    expect(lanes).toEqual({ a: 0, b: 1, c: 0 })
  })

  it('gives longer stays the upper lanes when they start together', () => {
    const segments = layoutWeek(week, [
      stay('short', '2026-11-09', '2026-11-10'),
      stay('long', '2026-11-09', '2026-11-14'),
    ])

    expect(segments.find((s) => s.item.id === 'long')?.lane).toBe(0)
  })

  it('counts the stays on each day', () => {
    const segments = layoutWeek(week, [
      stay('a', '2026-11-08', '2026-11-11'),
      stay('b', '2026-11-09', '2026-11-10'),
    ])

    expect(staysPerDay(segments, 7)).toEqual([1, 2, 1, 0, 0, 0, 0])
  })

  it('is empty for an empty week', () => {
    expect(layoutWeek([], [stay('a', '2026-11-08', '2026-11-11')])).toEqual([])
  })
})
