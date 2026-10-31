import type { Prisma, Property } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { RowInUseError } from '../../shared/database-errors.js'
import { type Page, toSkipTake } from '../../shared/pagination.js'
import { isForeignKeyViolation } from '../../shared/prisma-errors.js'
import { escapeLike } from '../../shared/search.js'
import type { ListPropertiesQuery } from './properties.schemas.js'

export type PropertyData = Omit<Prisma.PropertyUncheckedCreateInput, 'id' | 'userId'>

/** Every query is scoped to the owner: another user's property simply doesn't exist here. */
export class PropertiesRepository {
  constructor(private readonly db: Database) {}

  async list(
    userId: string,
    { search, ...pagination }: ListPropertiesQuery,
  ): Promise<Page<Property>> {
    const where: Prisma.PropertyWhereInput = {
      userId,
      ...(search ? { name: { contains: escapeLike(search), mode: 'insensitive' } } : {}),
    }
    const [items, total] = await this.db.$transaction([
      this.db.property.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(pagination),
      }),
      this.db.property.count({ where }),
    ])
    return { items, total, ...pagination }
  }

  find(userId: string, id: string): Promise<Property | null> {
    return this.db.property.findFirst({ where: { id, userId } })
  }

  create(userId: string, data: PropertyData): Promise<Property> {
    return this.db.property.create({ data: { ...data, userId } })
  }

  /** Returns null when the user has no such property. */
  async update(userId: string, id: string, data: Partial<PropertyData>): Promise<Property | null> {
    const { count } = await this.db.property.updateMany({ where: { id, userId }, data })
    return count === 0 ? null : this.find(userId, id)
  }

  /**
   * Returns false when the user has no such property; throws RowInUseError when it still
   * has bookings (the foreign key is the guard, so a booking created meanwhile counts).
   */
  async delete(userId: string, id: string): Promise<boolean> {
    try {
      const { count } = await this.db.property.deleteMany({ where: { id, userId } })
      return count === 1
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new RowInUseError('bookings')
      }
      throw error
    }
  }
}
