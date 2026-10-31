import { describe, expect, it } from 'vitest'

import type { Property } from '../../generated/prisma/client.js'
import {
  createPropertyBodySchema,
  propertySchema,
  toPublicProperty,
  updatePropertyBodySchema,
} from './properties.schemas.js'

describe('createPropertyBodySchema', () => {
  it('normalizes the address and blanks', () => {
    const parsed = createPropertyBodySchema.parse({
      name: '  Casa da praia ',
      type: 'HOUSE',
      zipCode: '88053-700',
      state: 'sc',
      city: ' Florianópolis ',
      neighborhood: '',
      street: null,
    })

    expect(parsed).toEqual({
      name: 'Casa da praia',
      type: 'HOUSE',
      zipCode: '88053700',
      state: 'SC',
      city: 'Florianópolis',
      neighborhood: null,
      street: null,
      number: null,
      complement: null,
      building: null,
      block: null,
      unit: null,
    })
  })

  it('needs only a name and a type', () => {
    expect(createPropertyBodySchema.safeParse({ name: 'Casa', type: 'HOUSE' }).success).toBe(true)
  })

  it('accepts apartment fields on an apartment', () => {
    const parsed = createPropertyBodySchema.parse({
      name: 'Apê',
      type: 'APARTMENT',
      building: 'Mar Azul',
      block: 'B',
      unit: '1204',
    })

    expect(parsed).toMatchObject({ building: 'Mar Azul', block: 'B', unit: '1204' })
  })

  it('rejects apartment fields on a house, one issue per field', () => {
    const result = createPropertyBodySchema.safeParse({
      name: 'Casa',
      type: 'HOUSE',
      building: 'X',
      unit: '1',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['building'], ['unit']])
  })

  it('treats blank apartment fields on a house as absent', () => {
    expect(
      createPropertyBodySchema.safeParse({ name: 'Casa', type: 'HOUSE', building: '  ' }).success,
    ).toBe(true)
  })

  it.each([
    ['no name', { type: 'HOUSE' }],
    ['a blank name', { name: '  ', type: 'HOUSE' }],
    ['an unknown type', { name: 'X', type: 'CASTLE' }],
    ['no type', { name: 'X' }],
    ['a bad CEP', { name: 'X', type: 'HOUSE', zipCode: '123' }],
    ['a bad UF', { name: 'X', type: 'HOUSE', state: 'XX' }],
    ['a number too long', { name: 'X', type: 'HOUSE', number: '1'.repeat(21) }],
  ])('rejects %s', (_case, body) => {
    expect(createPropertyBodySchema.safeParse(body).success).toBe(false)
  })
})

describe('updatePropertyBodySchema', () => {
  it('takes any subset of fields', () => {
    expect(updatePropertyBodySchema.parse({ city: 'Itajaí' })).toEqual({ city: 'Itajaí' })
  })

  it('keeps null to clear an optional field', () => {
    expect(updatePropertyBodySchema.parse({ complement: null })).toEqual({ complement: null })
  })

  it('rejects an empty update', () => {
    expect(updatePropertyBodySchema.safeParse({}).success).toBe(false)
  })

  it('rejects a null name', () => {
    expect(updatePropertyBodySchema.safeParse({ name: null }).success).toBe(false)
  })
})

describe('toPublicProperty', () => {
  const property: Property = {
    id: '018f0000-0000-7000-8000-000000000001',
    userId: '018f0000-0000-7000-8000-0000000000aa',
    name: 'Casa',
    type: 'HOUSE',
    zipCode: '88053700',
    state: 'SC',
    city: 'Florianópolis',
    neighborhood: null,
    street: null,
    number: null,
    complement: null,
    building: null,
    block: null,
    unit: null,
    createdAt: new Date('2026-10-31T12:00:00.000Z'),
    updatedAt: new Date('2026-10-31T13:00:00.000Z'),
  }

  it('drops the owner and formats the dates', () => {
    const output = toPublicProperty(property)

    expect(output).not.toHaveProperty('userId')
    expect(output.createdAt).toBe('2026-10-31T12:00:00.000Z')
    expect(propertySchema.safeParse(output).success).toBe(true)
  })
})
