import type { Database } from '../../shared/database.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js'
import type { Page } from '../../shared/pagination.js'
import { currentPlans } from '../plans/current-plan.js'
import type { AdminRepository } from './admin.repository.js'
import type { AdminUser, ListUsersQuery } from './admin.schemas.js'

export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly db: Database,
  ) {}

  /** 403 ADMIN_ONLY unless the account is an administrator now (not when the token was issued). */
  async assertAdmin(userId: string): Promise<void> {
    if (!(await this.admin.isAdmin(userId))) {
      throw new ForbiddenError('Only administrators can do this', { code: 'ADMIN_ONLY' })
    }
  }

  async listUsers(query: ListUsersQuery): Promise<Page<AdminUser>> {
    const page = await this.admin.listUsers(query)
    const plans = await currentPlans(
      this.db,
      page.items.map((user) => user.id),
    )
    return {
      ...page,
      items: page.items.map((user) => {
        const current = plans.get(user.id)
        if (!current) throw new Error(`No plan for user ${user.id}`)
        const { plan, source, grant } = current
        return {
          ...user,
          createdAt: user.createdAt.toISOString(),
          plan: { id: plan.id, code: plan.code, name: plan.name },
          planSource: source,
          grant: grant && { id: grant.id, endsAt: grant.endsAt?.toISOString() ?? null },
        }
      }),
    }
  }

  /**
   * Grants or removes the administrator role. An admin can't change their own (409
   * OWN_ADMIN_ROLE): there is always someone left who can undo a mistake.
   */
  async setAdmin(actorId: string, userId: string, isAdmin: boolean): Promise<void> {
    if (actorId === userId) {
      throw new ConflictError('Administrators cannot change their own role', {
        code: 'OWN_ADMIN_ROLE',
      })
    }
    if (!(await this.admin.setAdmin(userId, isAdmin))) {
      throw new NotFoundError('User not found', { code: 'USER_NOT_FOUND' })
    }
  }
}
