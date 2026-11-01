import { describe, expect, it, vi } from 'vitest'

import { fetchAllPages, MAX_PAGE_SIZE } from './all-pages'

function pages(total: number) {
  return vi.fn((page: number, pageSize: number) => {
    const start = (page - 1) * pageSize
    const items = Array.from(
      { length: Math.max(0, Math.min(pageSize, total - start)) },
      (_, i) => start + i,
    )
    return Promise.resolve({ items, total })
  })
}

describe('fetchAllPages', () => {
  it('stops at the first page when it holds everything', async () => {
    const fetchPage = pages(3)

    await expect(fetchAllPages(fetchPage)).resolves.toEqual([0, 1, 2])
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith(1, MAX_PAGE_SIZE)
  })

  it('fetches the rest of the pages, in order', async () => {
    const fetchPage = pages(250)

    const items = await fetchAllPages(fetchPage)

    expect(items).toHaveLength(250)
    expect(items.at(-1)).toBe(249)
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3])
  })

  it('is empty when there is nothing', async () => {
    await expect(fetchAllPages(pages(0))).resolves.toEqual([])
  })
})
