import type { Property } from '../../generated/prisma/client.js'
import { RowInUseError } from '../../shared/database-errors.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import type { Page } from '../../shared/pagination.js'
import type { PropertiesRepository } from './properties.repository.js'
import {
  APARTMENT_FIELDS,
  type CreatePropertyInput,
  type ListPropertiesQuery,
  type UpdatePropertyInput,
} from './properties.schemas.js'

const notFound = () => new NotFoundError('Property not found', { code: 'PROPERTY_NOT_FOUND' })

export class PropertiesService {
  constructor(private readonly properties: PropertiesRepository) {}

  list(userId: string, query: ListPropertiesQuery): Promise<Page<Property>> {
    return this.properties.list(userId, query)
  }

  async get(userId: string, id: string): Promise<Property> {
    const property = await this.properties.find(userId, id)
    if (!property) {
      throw notFound()
    }
    return property
  }

  create(userId: string, input: CreatePropertyInput): Promise<Property> {
    return this.properties.create(userId, input)
  }

  /**
   * Partial update. Turning an apartment into a house clears its apartment fields; giving
   * a house (or a property becoming one) apartment fields is a 400.
   */
  async update(userId: string, id: string, input: UpdatePropertyInput): Promise<Property> {
    const current = await this.get(userId, id)
    const type = input.type ?? current.type
    const changes = { ...input }

    if (type === 'HOUSE') {
      const sent = APARTMENT_FIELDS.filter((field) => changes[field])
      if (sent.length > 0) {
        throw new BadRequestError('Only apartments have these fields', {
          code: 'APARTMENT_FIELDS_ON_HOUSE',
          details: { fields: sent },
        })
      }
      for (const field of APARTMENT_FIELDS) {
        changes[field] = null
      }
    }

    const updated = await this.properties.update(userId, id, changes)
    // Deleted between the read above and this write.
    if (!updated) {
      throw notFound()
    }
    return updated
  }

  async delete(userId: string, id: string): Promise<void> {
    try {
      if (!(await this.properties.delete(userId, id))) {
        throw notFound()
      }
    } catch (error) {
      if (error instanceof RowInUseError) {
        throw new ConflictError('The property has bookings; delete them first', {
          code: 'PROPERTY_HAS_BOOKINGS',
        })
      }
      throw error
    }
  }
}
