import { z } from 'zod'

import { isValidCep, maskCep, onlyDigits, STATES } from '@/lib/validation/brazil'

import type { Property, PropertyInput } from './api'

const optional = (max: number, label: string) =>
  z.string().trim().max(max, `${label} longo demais.`)

export const propertyFormSchema = z.object({
  name: z.string().trim().min(1, 'Dê um nome ao imóvel.').max(255, 'Nome longo demais.'),
  type: z.enum(['HOUSE', 'APARTMENT']),
  zipCode: z.string().refine((value) => value === '' || isValidCep(value), 'CEP inválido.'),
  state: z.union([z.literal(''), z.enum(STATES)]),
  city: optional(255, 'Cidade'),
  neighborhood: optional(255, 'Bairro'),
  street: optional(255, 'Rua'),
  number: optional(20, 'Número'),
  complement: optional(255, 'Complemento'),
  building: optional(255, 'Edifício'),
  block: optional(50, 'Bloco'),
  unit: optional(20, 'Unidade'),
})

export type PropertyFormValues = z.infer<typeof propertyFormSchema>

export const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  name: '',
  type: 'HOUSE',
  zipCode: '',
  state: '',
  city: '',
  neighborhood: '',
  street: '',
  number: '',
  complement: '',
  building: '',
  block: '',
  unit: '',
}

export function toFormValues(property: Property): PropertyFormValues {
  const text = (value: string | null) => value ?? ''
  return {
    name: property.name,
    type: property.type,
    zipCode: maskCep(property.zipCode ?? ''),
    state: (property.state ?? '') as PropertyFormValues['state'],
    city: text(property.city),
    neighborhood: text(property.neighborhood),
    street: text(property.street),
    number: text(property.number),
    complement: text(property.complement),
    building: text(property.building),
    block: text(property.block),
    unit: text(property.unit),
  }
}

/** Parsed form values (already trimmed) to what the API takes: blank means no value, and only apartments have unit data. */
export function toPropertyInput(values: PropertyFormValues): Required<PropertyInput> {
  const orNull = (value: string) => value || null
  const apartment = values.type === 'APARTMENT'
  return {
    name: values.name,
    type: values.type,
    zipCode: values.zipCode ? onlyDigits(values.zipCode) : null,
    state: values.state || null,
    city: orNull(values.city),
    neighborhood: orNull(values.neighborhood),
    street: orNull(values.street),
    number: orNull(values.number),
    complement: orNull(values.complement),
    building: apartment ? orNull(values.building) : null,
    block: apartment ? orNull(values.block) : null,
    unit: apartment ? orNull(values.unit) : null,
  }
}
