import type { Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { type Page, toSkipTake } from '../../shared/pagination.js'
import { escapeLike } from '../../shared/search.js'
import type { ListUsersQuery } from './admin.schemas.js'

export interface UserRow {
  id: string
  name: string
  email: string
  isAdmin: boolean
  createdAt: Date
  propertyCount: number
}

/** Reads across every account: only the backoffice uses it, behind the admin check. */
export class AdminRepository {
  constructor(private readonly db: Database) {}

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } })
    return user?.isAdmin ?? false
  }

  /** Accounts by name, searched by part of the name or the e-mail. */
  async listUsers({ search, ...pagination }: ListUsersQuery): Promise<Page<UserRow>> {
    const term = search ? { contains: escapeLike(search), mode: 'insensitive' as const } : null
    const where: Prisma.UserWhereInput = term ? { OR: [{ name: term }, { email: term }] } : {}
    const [rows, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
          createdAt: true,
          _count: { select: { properties: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(pagination),
      }),
      this.db.user.count({ where }),
    ])
    const items = rows.map(({ _count, ...user }) => ({ ...user, propertyCount: _count.properties }))
    return { items, total, ...pagination }
  }

  /** Returns false when there is no such account. */
  async setAdmin(userId: string, isAdmin: boolean): Promise<boolean> {
    const { count } = await this.db.user.updateMany({ where: { id: userId }, data: { isAdmin } })
    return count === 1
  }
}
