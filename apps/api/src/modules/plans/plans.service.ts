import type { Plan } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { BadRequestError, NotFoundError } from '../../shared/errors.js'
import type { CreatePlanInput, UpdatePlanInput } from './plans.schemas.js'
import { FREE_PLAN } from './system-plans.js'

const notFound = () => new NotFoundError('Plan not found', { code: 'PLAN_NOT_FOUND' })

const PRICES = ['monthlyPrice', 'semiannualPrice', 'annualPrice'] as const

/** The backoffice's plans: create, change, take off sale. */
export class PlansService {
  constructor(private readonly db: Database) {}

  /** Every plan, Free first, then by name. */
  async list(): Promise<Plan[]> {
    const plans = await this.db.plan.findMany({ orderBy: { name: 'asc' } })
    return plans.sort((a, b) => Number(b.code === FREE_PLAN) - Number(a.code === FREE_PLAN))
  }

  create(input: CreatePlanInput): Promise<Plan> {
    return this.db.plan.create({ data: input })
  }

  /**
   * Changes a plan. Free stays free and on sale (400 FREE_PLAN_IS_FREE): it is what every
   * account falls back to.
   */
  async update(id: string, input: UpdatePlanInput): Promise<Plan> {
    const plan = await this.db.plan.findUnique({ where: { id } })
    if (!plan) throw notFound()
    if (plan.code === FREE_PLAN) {
      const priced = PRICES.find((field) => input[field] !== undefined && input[field] !== null)
      if (input.active === false || priced) {
        throw new BadRequestError('The Free plan is always free and on', {
          code: 'FREE_PLAN_IS_FREE',
          details: { field: priced ?? 'active' },
        })
      }
    }
    return this.db.plan.update({ where: { id }, data: input })
  }
}
