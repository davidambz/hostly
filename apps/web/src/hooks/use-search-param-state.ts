import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

import { SEARCH_MAX_LENGTH } from '@/components/search-input'

/** The API's highest page; anything past it is a broken link anyway. */
const MAX_PAGE = 100_000

/**
 * List state kept in the URL (`?q=casa&page=2`), so reloading, sharing a link and the back
 * button all keep the same view. Setting a value resets `page` unless it is the page.
 */
export function useSearchParamState() {
  const [params, setParams] = useSearchParams()

  const set = useCallback(
    (name: string, value: string | number | undefined) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === undefined || value === '' || (name === 'page' && Number(value) <= 1)) {
            next.delete(name)
          } else {
            next.set(name, String(value))
          }
          if (name !== 'page') next.delete('page')
          return next
        },
        { replace: name !== 'page' },
      )
    },
    [setParams],
  )

  const setSearch = useCallback(
    (value: string) => {
      set('q', value)
    },
    [set],
  )
  const setPage = useCallback(
    (value: number) => {
      set('page', value)
    },
    [set],
  )

  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1))
  /** `?q=`, cut to what the API accepts. */
  const search = (params.get('q') ?? '').trim().slice(0, SEARCH_MAX_LENGTH)
  return { params, page, search, set, setSearch, setPage }
}
