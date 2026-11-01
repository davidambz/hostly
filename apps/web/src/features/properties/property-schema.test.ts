import { describe, expect, it } from 'vitest'

import type { Property } from './api'
import { apartmentLine, placeLine, streetLine } from './property-format'
import {
  EMPTY_PROPERTY_FORM,
  propertyFormSchema,
  toFormValues,
  toPropertyInput,
} from './property-schema'

const property: Property = {
  id: 'p1',
  name: 'Apê Centro',
  type: 'APARTMENT',
  zipCode: '88330000',
  state: 'SC',
  city: 'Balneário Camboriú',
  neighborhood: 'Centro',
  street: 'Avenida Atlântica',
  number: '3500',
  complement: null,
  building: 'Mar Azul',
  block: 'B',
  unit: '1204',
  createdAt: '',
  updatedAt: '',
}

describe('toPropertyInput', () => {
  it('turns blanks into null and strips the CEP mask (after the schema trims)', () => {
    expect(
      toPropertyInput(
        propertyFormSchema.parse({
          ...EMPTY_PROPERTY_FORM,
          name: ' Casa ',
          zipCode: '88053-700',
          state: 'SC',
          city: '  ',
        }),
      ),
    ).toEqual({
      name: 'Casa',
      type: 'HOUSE',
      zipCode: '88053700',
      state: 'SC',
      city: null,
      neighborhood: null,
      street: null,
      number: null,
      complement: null,
      building: null,
      block: null,
      unit: null,
    })
  })

  it('drops apartment fields from a house, even if they were typed before switching', () => {
    const input = toPropertyInput({
      ...EMPTY_PROPERTY_FORM,
      name: 'Casa',
      type: 'HOUSE',
      unit: '101',
    })

    expect(input).toMatchObject({ building: null, block: null, unit: null })
  })

  it('keeps apartment fields on an apartment', () => {
    expect(
      toPropertyInput({ ...EMPTY_PROPERTY_FORM, name: 'Apê', type: 'APARTMENT', unit: '101' }).unit,
    ).toBe('101')
  })
})

describe('toFormValues', () => {
  it('masks the CEP and turns nulls into empty fields', () => {
    expect(toFormValues(property)).toMatchObject({
      zipCode: '88330-000',
      complement: '',
      unit: '1204',
    })
  })

  it('round-trips through the form unchanged', () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = property

    expect(toPropertyInput(toFormValues(property))).toEqual(fields)
  })

  it('leaves the CEP empty when there is none', () => {
    expect(toFormValues({ ...property, zipCode: null }).zipCode).toBe('')
  })
})

describe('propertyFormSchema', () => {
  it.each([
    ['no name', { name: ' ' }, 'Dê um nome ao imóvel.'],
    ['a short CEP', { zipCode: '88053' }, 'CEP inválido.'],
    ['an all-zero CEP', { zipCode: '00000-000' }, 'CEP inválido.'],
    ['a number too long', { number: '1'.repeat(21) }, 'Número longo demais.'],
  ])('rejects %s', (_case, change, message) => {
    const result = propertyFormSchema.safeParse({ ...EMPTY_PROPERTY_FORM, name: 'Casa', ...change })

    expect(result.error?.issues[0]?.message).toBe(message)
  })

  it('accepts an empty CEP and UF', () => {
    expect(propertyFormSchema.safeParse({ ...EMPTY_PROPERTY_FORM, name: 'Casa' }).success).toBe(
      true,
    )
  })
})

describe('property lines', () => {
  it('describe the address with the parts that are filled', () => {
    expect(streetLine(property)).toBe('Avenida Atlântica, 3500 · Centro')
    expect(placeLine(property)).toBe('Balneário Camboriú/SC')
    expect(apartmentLine(property)).toBe('Mar Azul · Bloco B · Unidade 1204')
  })

  it('are empty when nothing is filled', () => {
    const bare = {
      ...property,
      type: 'HOUSE' as const,
      street: null,
      number: null,
      neighborhood: null,
      city: null,
      state: null,
    }

    expect([streetLine(bare), placeLine(bare), apartmentLine(bare)]).toEqual(['', '', ''])
  })
})
