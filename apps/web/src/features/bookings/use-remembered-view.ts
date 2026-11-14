import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { readStored, writeStored } from '@/lib/local-store'

export const BOOKINGS_VIEW_KEY = 'hostly-bookings-view'

/** What picks the view: the property filter, calendar or list, month or week, and the date. */
const VIEW_PARAMS = ['imovel', 'modo', 'visao', 'data'] as const

function viewOf(params: URLSearchParams): string {
  const view = new URLSearchParams()
  for (const name of VIEW_PARAMS) {
    const value = params.get(name)
    if (value) view.set(name, value)
  }
  return view.toString()
}

/**
 * Opens the bookings where the user left them: arriving with no view in the URL (the top
 * bar's link, a fresh login) brings back the last property filter, mode, calendar view and
 * date; a link that says what to show is followed as is. The view is saved as it changes.
 */
export function useRememberedView() {
  const [params, setParams] = useSearchParams()
  const [restoring] = useState(() =>
    viewOf(params) === '' ? (readStored(BOOKINGS_VIEW_KEY) ?? '') : '',
  )

  useEffect(() => {
    if (restoring) setParams(new URLSearchParams(restoring), { replace: true })
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const view = viewOf(params)
  useEffect(() => {
    // Don't save the empty view of the first render over the one being brought back.
    if (restoring && view === '') return
    writeStored(BOOKINGS_VIEW_KEY, view)
  }, [restoring, view])
}
