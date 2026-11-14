import type { Property } from '../../generated/prisma/client.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import { deleteOrFail } from '../../shared/owned-rows.js'
import type { Page } from '../../shared/pagination.js'
import { currentPlan } from '../plans/current-plan.js'
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

  /**
   * 409 PLAN_LIMIT_REACHED when the user's plan allows no more properties. Existing ones are
   * never touched: a user over the limit (back on Free after Premium) just can't add more.
   */
  create(userId: string, input: CreatePropertyInput): Promise<Property> {
    return this.properties.create(userId, input, async (tx, count) => {
      const { plan } = await currentPlan(tx, userId)
      if (plan.maxProperties !== null && count >= plan.maxProperties) {
        throw new ConflictError('The plan allows no more properties', {
          code: 'PLAN_LIMIT_REACHED',
          details: { limit: plan.maxProperties, count, plan: plan.name },
        })
      }
    })
  }

  /**
   * Partial update. Turning an apartment into a house clears its apartment fields; giving
   * a house (or a property becoming one) apartment fields is a 400.
   */
  async update(userId: string, id: string, input: UpdatePropertyInput): Promise<Property> {
    const updated = await this.properties.update(userId, id, (current) => {
      const type = input.type ?? current.type
      if (type !== 'HOUSE') {
        return input
      }
      const sent = APARTMENT_FIELDS.filter((field) => input[field])
      if (sent.length > 0) {
        throw new BadRequestError('Only apartments have these fields', {
          code: 'APARTMENT_FIELDS_ON_HOUSE',
          details: { fields: sent },
        })
      }
      return { ...input, building: null, block: null, unit: null }
    })
    if (!updated) {
      throw notFound()
    }
    return updated
  }

  delete(userId: string, id: string): Promise<void> {
    return deleteOrFail(() => this.properties.delete(userId, id), {
      notFound,
      inUse: () =>
        new ConflictError('The property has bookings; delete them first', {
          code: 'PROPERTY_HAS_BOOKINGS',
        }),
    })
  }
}
