import type { Broker, BrokerType } from '../../generated/prisma/client.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import { deleteOrFail } from '../../shared/owned-rows.js'
import type { Page } from '../../shared/pagination.js'
import { isValidCnpj, isValidCpf } from '../../shared/validation/brazil.js'
import type { BrokersRepository } from './brokers.repository.js'
import type { CreateBrokerInput, ListBrokersQuery, UpdateBrokerInput } from './brokers.schemas.js'

/**
 * Why `document` doesn't fit `type`, or undefined when it does: an individual has a CPF,
 * a company a CNPJ (numeric or alphanumeric). No document is fine for both.
 */
export function documentError(type: BrokerType, document: string | null): string | undefined {
  if (document === null) return undefined
  if (type === 'INDIVIDUAL') return isValidCpf(document) ? undefined : 'Invalid CPF'
  return isValidCnpj(document) ? undefined : 'Invalid CNPJ'
}

/** The same 400 for create and update, so a form can handle both alike. */
function assertDocumentFits(type: BrokerType, document: string | null) {
  const message = documentError(type, document)
  if (message) {
    throw new BadRequestError(message, {
      code: 'INVALID_DOCUMENT',
      details: { field: 'document', type },
    })
  }
}

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

  async create(userId: string, input: CreateBrokerInput): Promise<Broker> {
    assertDocumentFits(input.type, input.document)
    return this.brokers.create(userId, input)
  }

  /**
   * Partial update. The document must fit the type the broker ends up with, so changing
   * the type means sending the matching document (or null to clear it).
   */
  async update(userId: string, id: string, input: UpdateBrokerInput): Promise<Broker> {
    const updated = await this.brokers.update(userId, id, (current) => {
      assertDocumentFits(
        input.type ?? current.type,
        input.document === undefined ? current.document : input.document,
      )
      return input
    })
    if (!updated) {
      throw notFound()
    }
    return updated
  }

  delete(userId: string, id: string): Promise<void> {
    return deleteOrFail(() => this.brokers.delete(userId, id), {
      notFound,
      inUse: () =>
        new ConflictError('The broker has bookings; remove it from them first', {
          code: 'BROKER_HAS_BOOKINGS',
        }),
    })
  }
}
