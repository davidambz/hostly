import { z } from 'zod'

import type { Broker } from '../../generated/prisma/client.js'
import { pageSchema, paginationQuerySchema } from '../../shared/pagination.js'
import {
  nameSchema,
  optionalDocumentSchema,
  optionalEmailSchema,
  optionalLandlinePhoneSchema,
  optionalMobilePhoneSchema,
} from '../../shared/validation/fields.js'

export const brokerTypeSchema = z.enum(['INDIVIDUAL', 'COMPANY'])

const brokerFields = {
  name: nameSchema,
  email: optionalEmailSchema,
  /** CPF for an individual, CNPJ for a company; masks accepted. */
  document: optionalDocumentSchema,
  mobilePhone: optionalMobilePhoneSchema,
  landlinePhone: optionalLandlinePhoneSchema,
}

/** Whether the document fits the type is checked by the service (400 INVALID_DOCUMENT). */
export const createBrokerBodySchema = z.object({ type: brokerTypeSchema, ...brokerFields })

export type CreateBrokerInput = z.infer<typeof createBrokerBodySchema>

/**
 * Every field optional; `null` (or blank) clears an optional one. Whether the document
 * fits the type is checked by the service against the stored broker.
 */
export const updateBrokerBodySchema = z
  .object({ type: brokerTypeSchema, ...brokerFields })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

export type UpdateBrokerInput = z.infer<typeof updateBrokerBodySchema>

export const brokerIdParamsSchema = z.object({ id: z.uuid() })

export const listBrokersQuerySchema = paginationQuerySchema.extend({
  /** Part of the name, any case. */
  search: z.string().trim().max(255).optional(),
})

export type ListBrokersQuery = z.infer<typeof listBrokersQuerySchema>

export const brokerSchema = z
  .object({
    id: z.uuid(),
    type: brokerTypeSchema,
    name: z.string(),
    email: z.string().nullable(),
    document: z.string().nullable(),
    mobilePhone: z.string().nullable(),
    landlinePhone: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Broker' })

export const brokerPageSchema = pageSchema(brokerSchema).meta({ id: 'BrokerPage' })

export type PublicBroker = z.infer<typeof brokerSchema>

export function toPublicBroker({ userId: _userId, ...broker }: Broker): PublicBroker {
  return {
    ...broker,
    createdAt: broker.createdAt.toISOString(),
    updatedAt: broker.updatedAt.toISOString(),
  }
}
