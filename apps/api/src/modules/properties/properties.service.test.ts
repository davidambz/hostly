import { describe, expect, it, vi } from 'vitest'

import type { Property } from '../../generated/prisma/client.js'
import { RowInUseError } from '../../shared/database-errors.js'
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js'
import type { PropertiesRepository } from './properties.repository.js'
import { PropertiesService } from './properties.service.js'

const apartment: Property = {
  id: 'p1',
  userId: 'u1',
  name: 'Apê',
  type: 'APARTMENT',
  zipCode: null,
  state: null,
  city: null,
  neighborhood: null,
  street: null,
  number: null,
  complement: null,
  building: 'Mar Azul',
  block: 'B',
  unit: '1204',
  createdAt: new Date(),
  updatedAt: new Date(),
}

function setup() {
  const repository: {
    list: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    current: Property | null
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  } = {
    list: vi.fn(),
    find: vi.fn<() => Promise<Property | null>>().mockResolvedValue(apartment),
    create: vi.fn(),
    // Mirrors the real repository: hands the stored property to `change`.
    current: apartment,
    update: vi.fn((_u: string, _id: string, change: (current: Property) => Partial<Property>) => {
      const current = repository.current
      return Promise.resolve(current ? { ...current, ...change(current) } : null)
    }),
    delete: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
  }
  const service = new PropertiesService(repository as unknown as PropertiesRepository)
  return { repository, service }
}

describe('PropertiesService.get', () => {
  it("answers 404 PROPERTY_NOT_FOUND for a property the user doesn't have", async () => {
    const { repository, service } = setup()
    repository.find.mockResolvedValue(null)

    const error = await service.get('u1', 'p1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NotFoundError)
    expect(error).toMatchObject({ code: 'PROPERTY_NOT_FOUND' })
  })
})

describe('PropertiesService.update', () => {
  const house = { ...apartment, type: 'HOUSE' as const, building: null, block: null, unit: null }

  it('passes the changes through for an apartment', async () => {
    const { service } = setup()

    await expect(service.update('u1', 'p1', { unit: '1301' })).resolves.toMatchObject({
      unit: '1301',
    })
  })

  it('clears the apartment fields when an apartment becomes a house', async () => {
    const { service } = setup()

    const updated = await service.update('u1', 'p1', { type: 'HOUSE' })

    expect(updated).toMatchObject({ type: 'HOUSE', building: null, block: null, unit: null })
  })

  it('rejects apartment fields when the property becomes a house', async () => {
    const { service } = setup()

    const error = await service
      .update('u1', 'p1', { type: 'HOUSE', block: 'C' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BadRequestError)
    expect(error).toMatchObject({
      code: 'APARTMENT_FIELDS_ON_HOUSE',
      details: { fields: ['block'] },
    })
  })

  it('rejects apartment fields on a house that stays a house', async () => {
    const { repository, service } = setup()
    repository.current = house

    await expect(service.update('u1', 'p1', { unit: '1' })).rejects.toMatchObject({
      code: 'APARTMENT_FIELDS_ON_HOUSE',
    })
  })

  it('decides from the type stored at write time, not an earlier read', async () => {
    const { repository, service } = setup()
    // Another request turned it into a house before this update got the lock.
    repository.current = house

    await expect(service.update('u1', 'p1', { building: 'X' })).rejects.toMatchObject({
      code: 'APARTMENT_FIELDS_ON_HOUSE',
    })
  })

  it('accepts clearing apartment fields on a house', async () => {
    const { repository, service } = setup()
    repository.current = house

    await expect(service.update('u1', 'p1', { unit: null })).resolves.toBeDefined()
  })

  it('answers 404 when the property is missing', async () => {
    const { repository, service } = setup()
    repository.current = null

    await expect(service.update('u1', 'p1', { name: 'X' })).rejects.toMatchObject({
      code: 'PROPERTY_NOT_FOUND',
    })
  })
})

describe('PropertiesService.delete', () => {
  it('deletes', async () => {
    const { repository, service } = setup()

    await service.delete('u1', 'p1')

    expect(repository.delete).toHaveBeenCalledWith('u1', 'p1')
  })

  it('answers 404 when there is nothing to delete', async () => {
    const { repository, service } = setup()
    repository.delete.mockResolvedValue(false)

    await expect(service.delete('u1', 'p1')).rejects.toMatchObject({ code: 'PROPERTY_NOT_FOUND' })
  })

  it('answers 409 PROPERTY_HAS_BOOKINGS while it still has bookings', async () => {
    const { repository, service } = setup()
    repository.delete.mockRejectedValue(new RowInUseError('bookings'))

    const error = await service.delete('u1', 'p1').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ code: 'PROPERTY_HAS_BOOKINGS' })
  })

  it('lets other errors through', async () => {
    const { repository, service } = setup()
    const failure = new Error('connection reset')
    repository.delete.mockRejectedValue(failure)

    await expect(service.delete('u1', 'p1')).rejects.toBe(failure)
  })
})
