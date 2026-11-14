import type { GrantDuration } from '../../generated/prisma/client.js'

const MONTHS: Record<Exclude<GrantDuration, 'LIFETIME'>, number> = {
  ONE_MONTH: 1,
  SIX_MONTHS: 6,
  ONE_YEAR: 12,
}

/**
 * When a grant of `duration` starting at `from` ends: the same day and time `n` months later
 * (the month's last day when it is shorter), or null for a lifetime grant.
 */
export function grantEnd(from: Date, duration: GrantDuration): Date | null {
  if (duration === 'LIFETIME') return null
  const months = MONTHS[duration]
  const end = new Date(from)
  const day = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, lastDay))
  return end
}

/** Whether a grant counts at `now`: not revoked, started, and not over. */
export function isInForce(
  grant: { startsAt: Date; endsAt: Date | null; revokedAt: Date | null },
  now: Date,
): boolean {
  return (
    grant.revokedAt === null &&
    grant.startsAt <= now &&
    (grant.endsAt === null || grant.endsAt > now)
  )
}
