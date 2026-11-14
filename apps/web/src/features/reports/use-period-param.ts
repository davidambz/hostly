import { useSearchParams } from 'react-router'

import { type Period, periodFromSearch, periodSearch } from './period'

/** The report's period, kept in the URL with any other value there (e.g. the property). */
export function usePeriodParam(): [Period, (period: Period) => void] {
  const [params, setParams] = useSearchParams()
  const goTo = (next: Period) => {
    setParams(
      (current) => {
        const search = new URLSearchParams(current)
        const values = Object.entries(periodSearch(next))
        // Removed first, so the period's values always come in the same order.
        for (const [name] of values) search.delete(name)
        for (const [name, value] of values) if (value) search.set(name, value)
        return search
      },
      { replace: true },
    )
  }
  return [periodFromSearch(params), goTo]
}
