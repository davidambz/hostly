import { describe, expect, it } from 'vitest'

import type { Broker } from '../../generated/prisma/client.js'
import {
  brokerSchema,
  createBrokerBodySchema,
  documentError,
  toPublicBroker,
  updateBrokerBodySchema,
} from './brokers.schemas.js'

describe('documentError', () => {
  it.each([
    ['INDIVIDUAL', '52998224725'],
    ['COMPANY', '11222333000181'],
    ['COMPANY', '12ABC34501DE35'],
    ['INDIVIDUAL', null],
    ['COMPANY', null],
  ] as const)('accepts %s with %s', (type, document) => {
    expect(documentError(type, document)).toBeUndefined()
  })

  it.each([
    ['INDIVIDUAL', '11222333000181', 'Invalid CPF'],
    ['INDIVIDUAL', '52998224726', 'Invalid CPF'],
    ['COMPANY', '52998224725', 'Invalid CNPJ'],
    ['COMPANY', '12ABC34501DE36', 'Invalid CNPJ'],
  ] as const)('rejects %s with %s', (type, document, message) => {
    expect(documentError(type, document)).toBe(message)
  })
})

describe('createBrokerBodySchema', () => {
  it('normalizes a company', () => {
    expect(
      createBrokerBodySchema.parse({
        type: 'COMPANY',
        name: ' Litoral Imóveis ',
        email: ' Contato@Litoral.COM ',
        document: '12.abc.345/01de-35',
        mobilePhone: '(48) 98877-6655',
        landlinePhone: '(48) 3322-1100',
      }),
    ).toEqual({
      type: 'COMPANY',
      name: 'Litoral Imóveis',
      email: 'contato@litoral.com',
      document: '12ABC34501DE35',
      mobilePhone: '48988776655',
      landlinePhone: '4833221100',
    })
  })

  it('needs only a type and a name', () => {
    expect(createBrokerBodySchema.parse({ type: 'INDIVIDUAL', name: 'Carlos' })).toEqual({
      type: 'INDIVIDUAL',
      name: 'Carlos',
      email: null,
      document: null,
      mobilePhone: null,
      landlinePhone: null,
    })
  })

  it.each([
    [
      'a CNPJ for an individual',
      { type: 'INDIVIDUAL', name: 'X', document: '11222333000181' },
      'document',
    ],
    ['a CPF for a company', { type: 'COMPANY', name: 'X', document: '52998224725' }, 'document'],
    [
      'a landline as mobile',
      { type: 'COMPANY', name: 'X', mobilePhone: '4833221100' },
      'mobilePhone',
    ],
    ['a bad e-mail', { type: 'COMPANY', name: 'X', email: 'x@' }, 'email'],
    ['no name', { type: 'COMPANY' }, 'name'],
    ['an unknown type', { type: 'AGENCY', name: 'X' }, 'type'],
  ])('rejects %s', (_case, body, path) => {
    const result = createBrokerBodySchema.safeParse(body)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([path])
  })
})

describe('updateBrokerBodySchema', () => {
  it('takes any subset, leaving the document check to the service', () => {
    expect(updateBrokerBodySchema.parse({ document: '11.222.333/0001-81' })).toEqual({
      document: '11222333000181',
    })
  })

  it('rejects an empty update', () => {
    expect(updateBrokerBodySchema.safeParse({}).success).toBe(false)
  })
})

it('toPublicBroker drops the owner and matches the schema', () => {
  const broker: Broker = {
    id: '018f0000-0000-7000-8000-000000000001',
    userId: '018f0000-0000-7000-8000-0000000000aa',
    type: 'COMPANY',
    name: 'Litoral',
    email: null,
    document: '12ABC34501DE35',
    mobilePhone: null,
    landlinePhone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const output = toPublicBroker(broker)

  expect(output).not.toHaveProperty('userId')
  expect(brokerSchema.safeParse(output).success).toBe(true)
})
