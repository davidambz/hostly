import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { setAccessToken } from '@/lib/api/session'

import { server } from './server'

// Under coverage on CI, renders and requests can take longer than the 1 s default.
configure({ asyncUtilTimeout: 5000 })

// jsdom has no matchMedia; the theme provider reads it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// jsdom has no ResizeObserver; Radix measures elements with it. Nothing to measure here.
const noop = () => undefined
class ResizeObserverStub {
  observe = noop
  unobserve = noop
  disconnect = noop
}
globalThis.ResizeObserver = ResizeObserverStub

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  setAccessToken(null)
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterAll(() => {
  server.close()
})
