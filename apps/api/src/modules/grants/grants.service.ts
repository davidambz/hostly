import type { GrantAction, Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import { isExclusionViolation } from '../../shared/prisma-errors.js'
import { FREE_PLAN } from '../plans/system-plans.js'
import { grantEnd, isInForce } from './grant-dates.js'
import type {
  ChangeGrantPlanInput,
  CreateGrantInput,
  PublicGrant,
  RenewGrantInput,
} from './grants.schemas.js'

const withHistory = {
  plan: { select: { id: true, code: true, name: true } },
  grantedBy: { select: { id: true, name: true } },
  events: {
    orderBy: { at: 'asc' },
    include: {
      plan: { select: { id: true, code: true, name: true } },
      actor: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PlanGrantInclude

type GrantWithHistory = Prisma.PlanGrantGetPayload<{ include: typeof withHistory }>

const grantNotFound = () => new NotFoundError('Grant not found', { code: 'GRANT_NOT_FOUND' })

const iso = (date: Date | null) => date?.toISOString() ?? null

/**
 * Plans an administrator gives a user, free of charge. One grant in force per user at a
 * time; every action is kept in the grant's history with who did it and why.
 */
export class GrantsService {
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The user's grants, newest first, each with its history. */
  async list(userId: string): Promise<PublicGrant[]> {
    await this.assertUser(userId)
    const grants = await this.db.planGrant.findMany({
      where: { userId },
      include: withHistory,
      orderBy: { createdAt: 'desc' },
    })
    return grants.map((grant) => this.toPublic(grant))
  }

  /**
   * Gives `userId` a plan for `duration`, from now. 409 ACTIVE_GRANT_EXISTS when one is in
   * force (renew, change or revoke it instead).
   */
  async grant(actorId: string, userId: string, input: CreateGrantInput): Promise<PublicGrant> {
    await this.assertUser(userId)
    await this.assertGrantable(input.planId)
    const now = this.now()
    const current = await this.db.planGrant.findFirst({
      where: { userId, revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    })
    if (current) throw activeGrantExists()
    const endsAt = grantEnd(now, input.duration)
    try {
      const grant = await this.db.planGrant.create({
        data: {
          userId,
          planId: input.planId,
          grantedById: actorId,
          duration: input.duration,
          startsAt: now,
          endsAt,
          reason: input.reason,
          events: {
            create: event(actorId, 'GRANTED', input.planId, endsAt, input.duration, input.reason),
          },
        },
        include: withHistory,
      })
      return this.toPublic(grant)
    } catch (error) {
      // Another grant got in at the same moment: the database refuses the overlap.
      if (isExclusionViolation(error)) throw activeGrantExists()
      throw error
    }
  }

  /** Extends a grant by `duration`, from its end (or from now, if it is already over). */
  async renew(actorId: string, grantId: string, input: RenewGrantInput): Promise<PublicGrant> {
    return this.change(grantId, (grant) => {
      const now = this.now()
      const from = grant.endsAt && grant.endsAt > now ? grant.endsAt : now
      const endsAt = grantEnd(from, input.duration)
      return {
        data: { duration: input.duration, endsAt, startsAt: grant.startsAt },
        event: event(actorId, 'RENEWED', grant.planId, endsAt, input.duration, input.reason),
      }
    })
  }

  /** Swaps the plan of a grant in force, keeping its dates. */
  async changePlan(
    actorId: string,
    grantId: string,
    input: ChangeGrantPlanInput,
  ): Promise<PublicGrant> {
    await this.assertGrantable(input.planId)
    return this.change(grantId, (grant) => ({
      data: { planId: input.planId },
      event: event(actorId, 'PLAN_CHANGED', input.planId, grant.endsAt, null, input.reason),
    }))
  }

  /** Ends a grant now: the user goes back to what they had without it. */
  async revoke(actorId: string, grantId: string, reason: string): Promise<PublicGrant> {
    return this.change(grantId, (grant) => ({
      data: { revokedAt: this.now() },
      event: event(actorId, 'REVOKED', grant.planId, grant.endsAt, null, reason),
    }))
  }

  /** Applies a change to a grant that is not revoked, and records it, in one transaction. */
  private async change(
    grantId: string,
    decide: (grant: { planId: string; startsAt: Date; endsAt: Date | null }) => {
      data: Prisma.PlanGrantUncheckedUpdateInput
      event: ReturnType<typeof event>
    },
  ): Promise<PublicGrant> {
    const grant = await this.db.$transaction(async (tx) => {
      const current = await tx.planGrant.findUnique({ where: { id: grantId } })
      if (!current) throw grantNotFound()
      if (current.revokedAt) {
        throw new ConflictError('The grant was revoked', { code: 'GRANT_REVOKED' })
      }
      const { data, event: change } = decide(current)
      return tx.planGrant.update({
        where: { id: grantId },
        data: { ...data, events: { create: change } },
        include: withHistory,
      })
    })
    return this.toPublic(grant)
  }

  private async assertUser(userId: string) {
    if (!(await this.db.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
      throw new NotFoundError('User not found', { code: 'USER_NOT_FOUND' })
    }
  }

  /** A plan that exists, is on sale and isn't Free (granting Free is revoking). */
  private async assertGrantable(planId: string) {
    const plan = await this.db.plan.findUnique({ where: { id: planId } })
    if (!plan) {
      throw new NotFoundError('Plan not found', {
        code: 'PLAN_NOT_FOUND',
        details: { field: 'planId' },
      })
    }
    if (plan.code === FREE_PLAN) {
      throw new BadRequestError('Free is what everyone has: revoke the grant instead', {
        code: 'CANNOT_GRANT_FREE',
        details: { field: 'planId' },
      })
    }
    if (!plan.active) {
      throw new BadRequestError('The plan is not on sale', {
        code: 'PLAN_INACTIVE',
        details: { field: 'planId' },
      })
    }
  }

  private toPublic(grant: GrantWithHistory): PublicGrant {
    return {
      id: grant.id,
      plan: grant.plan,
      duration: grant.duration,
      startsAt: grant.startsAt.toISOString(),
      endsAt: iso(grant.endsAt),
      reason: grant.reason,
      revokedAt: iso(grant.revokedAt),
      inForce: isInForce(grant, this.now()),
      grantedBy: grant.grantedBy,
      events: grant.events.map((item) => ({
        action: item.action,
        plan: item.plan,
        endsAt: iso(item.endsAt),
        duration: item.duration,
        reason: item.reason,
        at: item.at.toISOString(),
        actor: item.actor,
      })),
    }
  }
}

function activeGrantExists() {
  return new ConflictError('The user already has a grant in force', {
    code: 'ACTIVE_GRANT_EXISTS',
  })
}

function event(
  actorId: string,
  action: GrantAction,
  planId: string,
  endsAt: Date | null,
  duration: Prisma.PlanGrantEventCreateWithoutGrantInput['duration'],
  reason: string,
) {
  return { actorId, action, planId, endsAt, duration, reason }
}
