import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  DEFAULT_PAGE_SIZE,
  mapPage,
  MAX_PAGE_SIZE,
  pageSchema,
  paginationQuerySchema,
  toSkipTake,
} from './pagination.js'

describe('paginationQuerySchema', () => {
  it('defaults to the first page', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  })

  it('coerces query string values', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    })
  })

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { pageSize: '0' },
    { pageSize: String(MAX_PAGE_SIZE + 1) },
  ])('rejects %j', (query) => {
    expect(paginationQuerySchema.safeParse(query).success).toBe(false)
  })
})

describe('toSkipTake', () => {
  it.each([
    [
      { page: 1, pageSize: 20 },
      { skip: 0, take: 20 },
    ],
    [
      { page: 3, pageSize: 10 },
      { skip: 20, take: 10 },
    ],
  ])('%j → %j', (pagination, expected) => {
    expect(toSkipTake(pagination)).toEqual(expected)
  })
})

describe('mapPage', () => {
  it('maps the items and keeps the paging info', () => {
    expect(mapPage({ items: [1, 2], page: 2, pageSize: 2, total: 4 }, (n) => n * 10)).toEqual({
      items: [10, 20],
      page: 2,
      pageSize: 2,
      total: 4,
    })
  })
})

describe('pageSchema', () => {
  it('validates a page of the given item', () => {
    const schema = pageSchema(z.string())

    expect(schema.safeParse({ items: ['a'], page: 1, pageSize: 20, total: 1 }).success).toBe(true)
    expect(schema.safeParse({ items: [1], page: 1, pageSize: 20, total: 1 }).success).toBe(false)
  })
})
