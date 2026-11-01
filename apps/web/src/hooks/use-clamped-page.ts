import { useEffect } from 'react'

/**
 * A deletion or an old link can leave a list on a page past its last one. This sends it
 * to the last page and tells the caller to keep showing "loading" until it gets there.
 */
export function useClampedPage({
  page,
  pageSize,
  total,
  empty,
  goTo,
}: {
  page: number
  pageSize: number
  /** Undefined while the list hasn't loaded. */
  total: number | undefined
  empty: boolean
  goTo: (page: number) => void
}): boolean {
  const lastPage = Math.max(1, Math.ceil((total ?? 0) / pageSize))
  const pastTheEnd = total !== undefined && empty && page > lastPage

  useEffect(() => {
    if (pastTheEnd) goTo(lastPage)
  }, [pastTheEnd, lastPage, goTo])

  return pastTheEnd
}
