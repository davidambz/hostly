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

  /**
   * Sets several values at once. Two separate calls in the same event would not add up:
   * each starts from the URL as it was when the event began.
   */
  const update = useCallback(
    (changes: Record<string, string | number | undefined>) => {
      const names = Object.keys(changes)
      const onlyPage = names.length === 1 && names[0] === 'page'
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [name, value] of Object.entries(changes)) {
            if (value === undefined || value === '' || (name === 'page' && Number(value) <= 1)) {
              next.delete(name)
            } else {
              next.set(name, String(value))
            }
          }
          if (!('page' in changes)) next.delete('page')
          return next
        },
        // Pages go into the history, so the back button pages back; the rest replaces.
        { replace: !onlyPage },
      )
    },
    [setParams],
  )

  const set = useCallback(
    (name: string, value: string | number | undefined) => {
      update({ [name]: value })
    },
    [update],
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
  return { params, page, search, set, update, setSearch, setPage }
}
