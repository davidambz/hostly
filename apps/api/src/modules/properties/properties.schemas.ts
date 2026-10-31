import { z } from 'zod'

import type { Property } from '../../generated/prisma/client.js'
import { pageSchema, paginationQuerySchema } from '../../shared/pagination.js'
import { cepSchema, optionalText, stateSchema } from '../../shared/validation/fields.js'

export const propertyTypeSchema = z.enum(['HOUSE', 'APARTMENT'])

export const APARTMENT_FIELDS = ['building', 'block', 'unit'] as const

/** Everything but the type: shared by create and update. */
const propertyFields = {
  name: z.string().trim().min(1, 'Required').max(255),
  zipCode: cepSchema,
  state: stateSchema,
  city: optionalText(255),
  neighborhood: optionalText(255),
  street: optionalText(255),
  number: optionalText(20),
  complement: optionalText(255),
  building: optionalText(255),
  block: optionalText(50),
  unit: optionalText(20),
}

export const createPropertyBodySchema = z
  .object({ type: propertyTypeSchema, ...propertyFields })
  .superRefine((property, ctx) => {
    if (property.type === 'HOUSE') {
      for (const field of APARTMENT_FIELDS) {
        if (property[field] !== null) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Only apartments have this field',
          })
        }
      }
    }
  })

export type CreatePropertyInput = z.infer<typeof createPropertyBodySchema>

/**
 * Every field optional; `null` (or blank) clears an optional one. Whether the apartment
 * fields fit the type is checked by the service against the stored property.
 */
export const updatePropertyBodySchema = z
  .object({ type: propertyTypeSchema, ...propertyFields })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })

export type UpdatePropertyInput = z.infer<typeof updatePropertyBodySchema>

export const propertyIdParamsSchema = z.object({ id: z.uuid() })

export const listPropertiesQuerySchema = paginationQuerySchema.extend({
  /** Part of the name, any case. */
  search: z.string().trim().max(255).optional(),
})

export type ListPropertiesQuery = z.infer<typeof listPropertiesQuerySchema>

export const propertySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: propertyTypeSchema,
    zipCode: z.string().nullable(),
    state: z.string().nullable(),
    city: z.string().nullable(),
    neighborhood: z.string().nullable(),
    street: z.string().nullable(),
    number: z.string().nullable(),
    complement: z.string().nullable(),
    building: z.string().nullable(),
    block: z.string().nullable(),
    unit: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Property' })

export const propertyPageSchema = pageSchema(propertySchema).meta({ id: 'PropertyPage' })

export type PublicProperty = z.infer<typeof propertySchema>

export function toPublicProperty({ userId: _userId, ...property }: Property): PublicProperty {
  return {
    ...property,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  }
}
