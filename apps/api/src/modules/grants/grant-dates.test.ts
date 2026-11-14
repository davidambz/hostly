import { describe, expect, it } from 'vitest'

import { grantEnd, isInForce } from './grant-dates.js'

const at = (iso: string) => new Date(iso)

describe('grantEnd', () => {
  it.each([
    ['ONE_MONTH', '2026-11-14T10:00:00.000Z', '2026-12-14T10:00:00.000Z'],
    ['SIX_MONTHS', '2026-11-14T10:00:00.000Z', '2027-05-14T10:00:00.000Z'],
    ['ONE_YEAR', '2026-11-14T10:00:00.000Z', '2027-11-14T10:00:00.000Z'],
    // The month's last day when the next one is shorter.
    ['ONE_MONTH', '2027-01-31T10:00:00.000Z', '2027-02-28T10:00:00.000Z'],
    ['ONE_YEAR', '2028-02-29T10:00:00.000Z', '2029-02-28T10:00:00.000Z'],
  ] as const)('%s from %s ends %s', (duration, from, end) => {
    expect(grantEnd(at(from), duration)?.toISOString()).toBe(end)
  })

  it('never ends for a lifetime grant', () => {
    expect(grantEnd(at('2026-11-14T10:00:00.000Z'), 'LIFETIME')).toBeNull()
  })
})

describe('isInForce', () => {
  const now = at('2026-11-14T10:00:00.000Z')
  const grant = {
    startsAt: at('2026-11-01T00:00:00.000Z'),
    endsAt: at('2026-12-01T00:00:00.000Z'),
    revokedAt: null,
  }

  it.each([
    ['running', grant, true],
    ['for life', { ...grant, endsAt: null }, true],
    ['over', { ...grant, endsAt: now }, false],
    ['not started', { ...grant, startsAt: at('2026-11-15T00:00:00.000Z') }, false],
    ['revoked', { ...grant, revokedAt: now }, false],
  ])('is %s → %s', (_case, value, inForce) => {
    expect(isInForce(value, now)).toBe(inForce)
  })
})
