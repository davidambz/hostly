/** The API's largest page size. */
export const MAX_PAGE_SIZE = 100

interface Page<T> {
  items: T[]
  total: number
}

/**
 * Every item of a paginated list: the first page says how many there are, and the rest
 * are fetched together. For pickers and maps that need the whole list.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<Page<T>>,
): Promise<T[]> {
  const first = await fetchPage(1, MAX_PAGE_SIZE)
  const pages = Math.ceil(first.total / MAX_PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
      fetchPage(index + 2, MAX_PAGE_SIZE),
    ),
  )
  return [first, ...rest].flatMap((page) => page.items)
}
