import type { Prisma, Property } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { type Page, toSkipTake } from '../../shared/pagination.js'
import { deleteOwnedRow, lockOwnedRow } from '../../shared/owned-rows.js'
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

  /**
   * Updates the property with the changes `change` derives from its current state, in one
   * transaction with the row locked, so a concurrent update can't slip in between the
   * read and the write. Returns null when the user has no such property; whatever
   * `change` throws aborts the update.
   */
  async update(
    userId: string,
    id: string,
    change: (current: Property) => Partial<PropertyData>,
  ): Promise<Property | null> {
    return this.db.$transaction(async (tx) => {
      if (!(await lockOwnedRow(tx, 'properties', id, userId))) return null
      const property = await tx.property.findUniqueOrThrow({ where: { id } })
      return tx.property.update({ where: { id }, data: change(property) })
    })
  }

  /**
   * Returns false when the user has no such property; throws RowInUseError when it still
   * has bookings (the foreign key is the guard, so a booking created meanwhile counts).
   */
  delete(userId: string, id: string): Promise<boolean> {
    return deleteOwnedRow(() => this.db.property.deleteMany({ where: { id, userId } }), 'bookings')
  }
}
