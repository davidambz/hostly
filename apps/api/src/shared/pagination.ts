import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export type Pagination = z.infer<typeof paginationQuerySchema>

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** The response schema of a paginated list of `item`. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
}

/** `skip`/`take` for a Prisma query. */
export function toSkipTake({ page, pageSize }: Pagination) {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

export function mapPage<T, U>(page: Page<T>, map: (item: T) => U): Page<U> {
  return { ...page, items: page.items.map(map) }
}
