import type { Broker } from '../../generated/prisma/client.js'
import { RowInUseError } from '../../shared/database-errors.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import type { Page } from '../../shared/pagination.js'
import type { BrokersRepository } from './brokers.repository.js'
import {
  type CreateBrokerInput,
  documentError,
  type ListBrokersQuery,
  type UpdateBrokerInput,
} from './brokers.schemas.js'

const notFound = () => new NotFoundError('Broker not found', { code: 'BROKER_NOT_FOUND' })

export class BrokersService {
  constructor(private readonly brokers: BrokersRepository) {}

  list(userId: string, query: ListBrokersQuery): Promise<Page<Broker>> {
    return this.brokers.list(userId, query)
  }

  async get(userId: string, id: string): Promise<Broker> {
    const broker = await this.brokers.find(userId, id)
    if (!broker) {
      throw notFound()
    }
    return broker
  }

  create(userId: string, input: CreateBrokerInput): Promise<Broker> {
    return this.brokers.create(userId, input)
  }

  /**
   * Partial update. The document must fit the type the broker ends up with, so changing
   * the type means sending the matching document (or null to clear it).
   */
  async update(userId: string, id: string, input: UpdateBrokerInput): Promise<Broker> {
    const updated = await this.brokers.update(userId, id, (current) => {
      const type = input.type ?? current.type
      const document = input.document === undefined ? current.document : input.document
      const message = documentError(type, document)
      if (message) {
        throw new BadRequestError(message, {
          code: 'INVALID_DOCUMENT',
          details: { field: 'document', type },
        })
      }
      return input
    })
    if (!updated) {
      throw notFound()
    }
    return updated
  }

  async delete(userId: string, id: string): Promise<void> {
    let deleted: boolean
    try {
      deleted = await this.brokers.delete(userId, id)
    } catch (error) {
      if (error instanceof RowInUseError) {
        throw new ConflictError('The broker has bookings; remove it from them first', {
          code: 'BROKER_HAS_BOOKINGS',
        })
      }
      throw error
    }
    if (!deleted) {
      throw notFound()
    }
  }
}
