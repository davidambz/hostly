import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { toast } from 'sonner'
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

// jsdom has no pointer capture; the toasts call it when one is pressed (e.g. "Desfazer").
Element.prototype.setPointerCapture = () => undefined
Element.prototype.releasePointerCapture = () => undefined
Element.prototype.hasPointerCapture = () => false

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
  // The toasts live in a module-wide store: without this, one test's notices crowd the next.
  toast.dismiss()
  cleanup()
  server.resetHandlers()
  setAccessToken(null)
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterAll(() => {
  server.close()
})
