import { useCallback, useState } from 'react'

/**
 * State of a panel or dialog about one item. The item stays after closing, so the content
 * doesn't change while it animates out.
 */
export function useOverlay<T>() {
  const [state, setState] = useState<{ open: boolean; item?: T }>({ open: false })

  const show = useCallback((item?: T) => {
    setState({ open: true, item })
  }, [])
  const setOpen = useCallback((open: boolean) => {
    setState((current) => ({ ...current, open }))
  }, [])

  return { open: state.open, item: state.item, show, setOpen }
}
