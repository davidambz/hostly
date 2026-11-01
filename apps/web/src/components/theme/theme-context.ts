import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'

/** Same key as the inline script in index.html, which applies it before the first paint. */
export const THEME_STORAGE_KEY = 'hostly-theme'

export interface ThemeContextValue {
  /** What the user picked. */
  theme: Theme
  /** What is on screen: `system` resolved to light or dark. */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return context
}
