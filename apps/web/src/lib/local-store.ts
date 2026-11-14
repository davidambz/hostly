/**
 * Small per-browser conveniences in localStorage. Storage can be missing or throw (private
 * windows, blocked site data), so every access is guarded and a failure reads as "nothing
 * saved": these values only ever make the app nicer, never decide what is true.
 */

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Nothing saved; the app works the same, just without the convenience.
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to do.
  }
}
