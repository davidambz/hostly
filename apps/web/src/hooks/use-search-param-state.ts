import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

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

  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  return { params, page, set }
}
