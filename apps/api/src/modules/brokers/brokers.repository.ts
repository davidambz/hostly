import type { Broker, Prisma } from '../../generated/prisma/client.js'
import type { Database } from '../../shared/database.js'
import { deleteOwnedRow, lockOwnedRow } from '../../shared/owned-rows.js'
import { type Page, toSkipTake } from '../../shared/pagination.js'
import { escapeLike } from '../../shared/search.js'
import type { ListBrokersQuery } from './brokers.schemas.js'

export type BrokerData = Omit<Prisma.BrokerUncheckedCreateInput, 'id' | 'userId'>

/** Every query is scoped to the owner: another user's broker simply doesn't exist here. */
export class BrokersRepository {
  constructor(private readonly db: Database) {}

  async list(userId: string, { search, ...pagination }: ListBrokersQuery): Promise<Page<Broker>> {
    const where: Prisma.BrokerWhereInput = {
      userId,
      ...(search ? { name: { contains: escapeLike(search), mode: 'insensitive' } } : {}),
    }
    const [items, total] = await this.db.$transaction([
      this.db.broker.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(pagination),
      }),
      this.db.broker.count({ where }),
    ])
    return { items, total, ...pagination }
  }

  find(userId: string, id: string): Promise<Broker | null> {
    return this.db.broker.findFirst({ where: { id, userId } })
  }

  create(userId: string, data: BrokerData): Promise<Broker> {
    return this.db.broker.create({ data: { ...data, userId } })
  }

  /**
   * Updates the broker with the changes `change` derives from its current state, in one
   * transaction with the row locked. Returns null when the user has no such broker;
   * whatever `change` throws aborts the update.
   */
  async update(
    userId: string,
    id: string,
    change: (current: Broker) => Partial<BrokerData>,
  ): Promise<Broker | null> {
    return this.db.$transaction(async (tx) => {
      if (!(await lockOwnedRow(tx, 'brokers', id, userId))) return null
      const broker = await tx.broker.findUniqueOrThrow({ where: { id } })
      return tx.broker.update({ where: { id }, data: change(broker) })
    })
  }

  /**
   * Returns false when the user has no such broker; throws RowInUseError when bookings
   * still reference it.
   */
  delete(userId: string, id: string): Promise<boolean> {
    return deleteOwnedRow(() => this.db.broker.deleteMany({ where: { id, userId } }), 'bookings')
  }
}
