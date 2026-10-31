import { describe, expect, it, vi } from 'vitest'

import type { Broker } from '../../generated/prisma/client.js'
import { RowInUseError } from '../../shared/database-errors.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import type { BrokersRepository } from './brokers.repository.js'
import { BrokersService, documentError } from './brokers.service.js'

const company: Broker = {
  id: 'b1',
  userId: 'u1',
  type: 'COMPANY',
  name: 'Litoral',
  email: null,
  document: '11222333000181',
  mobilePhone: null,
  landlinePhone: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function setup() {
  const repository = {
    current: company as Broker | null,
    find: vi.fn(() => Promise.resolve(repository.current)),
    update: vi.fn((_u: string, _id: string, change: (current: Broker) => Partial<Broker>) => {
      const current = repository.current
      return Promise.resolve(current ? { ...current, ...change(current) } : null)
    }),
    create: vi.fn((_u: string, data: object) => Promise.resolve({ ...company, ...data })),
    delete: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  }
  const service = new BrokersService(repository as unknown as BrokersRepository)
  return { repository, service }
}

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

describe('BrokersService.create', () => {
  const base = { name: 'X', email: null, mobilePhone: null, landlinePhone: null }

  it('creates a broker whose document fits its type', async () => {
    const { repository, service } = setup()

    await service.create('u1', { ...base, type: 'COMPANY', document: '12ABC34501DE35' })

    expect(repository.create).toHaveBeenCalled()
  })

  it.each([
    ['INDIVIDUAL', '11222333000181', 'Invalid CPF'],
    ['COMPANY', '52998224725', 'Invalid CNPJ'],
  ] as const)(
    'answers 400 INVALID_DOCUMENT for a %s with %s, like an update would',
    async (type, document, message) => {
      const { repository, service } = setup()

      await expect(service.create('u1', { ...base, type, document })).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_DOCUMENT',
        message,
        details: { field: 'document', type },
      })
      expect(repository.create).not.toHaveBeenCalled()
    },
  )
})

describe('BrokersService.get', () => {
  it('answers 404 BROKER_NOT_FOUND for a broker the user does not have', async () => {
    const { repository, service } = setup()
    repository.current = null

    const error = await service.get('u1', 'b1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ code: 'BROKER_NOT_FOUND' })
  })
})

describe('BrokersService.update', () => {
  it('passes changes that keep the document valid', async () => {
    const { service } = setup()

    await expect(service.update('u1', 'b1', { name: 'Litoral Imóveis' })).resolves.toMatchObject({
      name: 'Litoral Imóveis',
    })
  })

  it('accepts a type change with the matching document', async () => {
    const { service } = setup()

    await expect(
      service.update('u1', 'b1', { type: 'INDIVIDUAL', document: '52998224725' }),
    ).resolves.toMatchObject({ type: 'INDIVIDUAL', document: '52998224725' })
  })

  it('accepts a type change that clears the document', async () => {
    const { service } = setup()

    await expect(
      service.update('u1', 'b1', { type: 'INDIVIDUAL', document: null }),
    ).resolves.toMatchObject({ type: 'INDIVIDUAL', document: null })
  })

  it('rejects a type change that keeps a document of the other kind', async () => {
    const { service } = setup()

    const error = await service.update('u1', 'b1', { type: 'INDIVIDUAL' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BadRequestError)
    expect(error).toMatchObject({
      code: 'INVALID_DOCUMENT',
      message: 'Invalid CPF',
      details: { field: 'document', type: 'INDIVIDUAL' },
    })
  })

  it('rejects a document that does not fit the stored type', async () => {
    const { service } = setup()

    await expect(service.update('u1', 'b1', { document: '52998224725' })).rejects.toMatchObject({
      code: 'INVALID_DOCUMENT',
      message: 'Invalid CNPJ',
    })
  })

  it('answers 404 when the broker is missing', async () => {
    const { repository, service } = setup()
    repository.current = null

    await expect(service.update('u1', 'b1', { name: 'X' })).rejects.toMatchObject({
      code: 'BROKER_NOT_FOUND',
    })
  })
})

describe('BrokersService.delete', () => {
  it('answers 404 when there is nothing to delete', async () => {
    const { repository, service } = setup()
    repository.delete.mockResolvedValue(false)

    await expect(service.delete('u1', 'b1')).rejects.toMatchObject({ code: 'BROKER_NOT_FOUND' })
  })

  it('answers 409 BROKER_HAS_BOOKINGS while bookings reference it', async () => {
    const { repository, service } = setup()
    repository.delete.mockRejectedValue(new RowInUseError('bookings'))

    const error = await service.delete('u1', 'b1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'BROKER_HAS_BOOKINGS' })
  })

  it('lets other errors through', async () => {
    const { repository, service } = setup()
    const failure = new Error('connection reset')
    repository.delete.mockRejectedValue(failure)

    await expect(service.delete('u1', 'b1')).rejects.toBe(failure)
  })
})
