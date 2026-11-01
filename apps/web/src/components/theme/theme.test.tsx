import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ModeToggle } from './mode-toggle'
import { THEME_STORAGE_KEY, useTheme } from './theme-context'
import { ThemeProvider } from './theme-provider'

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>

function mockSystemDark(dark: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = []
  vi.mocked(window.matchMedia).mockImplementation(
    (query: string) =>
      ({
        matches: dark,
        media: query,
        addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
          listeners.push(listener),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
  return (matches: boolean) => {
    for (const listener of listeners) listener({ matches })
  }
}

describe('ThemeProvider', () => {
  it('follows the system by default', () => {
    mockSystemDark(true)

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('reacts when the system switches while on "system"', () => {
    const switchSystem = mockSystemDark(false)
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      switchSystem(true)
    })

    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('remembers an explicit choice and ignores the system', () => {
    mockSystemDark(true)
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme('light')
    })

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('starts from the saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('dark')
  })

  it('ignores a corrupted saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')

    expect(renderHook(() => useTheme(), { wrapper }).result.current.theme).toBe('system')
  })

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('refuses to be used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => renderHook(() => useTheme())).toThrow('inside <ThemeProvider>')
  })
})

describe('ModeToggle', () => {
  it('offers light, dark and system, and marks the current one', async () => {
    const user = userEvent.setup()
    render(<ModeToggle />, { wrapper })

    await user.click(screen.getByRole('button', { name: 'Alterar tema' }))

    expect(screen.getByRole('menuitemradio', { name: 'Claro', checked: false })).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: 'Escuro', checked: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: 'Sistema', checked: true }),
    ).toBeInTheDocument()
  })

  it('switches to dark mode', async () => {
    const user = userEvent.setup()
    render(<ModeToggle />, { wrapper })

    await user.click(screen.getByRole('button', { name: 'Alterar tema' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Escuro' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
