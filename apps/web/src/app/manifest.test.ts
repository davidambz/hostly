import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/** A path inside apps/web. */
const web = (path: string) => join(dirname(fileURLToPath(import.meta.url)), '../..', path)

interface Manifest {
  name: string
  start_url: string
  display: string
  icons: { src: string; sizes: string; purpose: string }[]
}

describe('install manifest', () => {
  const manifest = JSON.parse(readFileSync(web('public/manifest.webmanifest'), 'utf8')) as Manifest

  it('opens Hostly on the bookings, as a standalone app', () => {
    expect(manifest).toMatchObject({
      name: 'Hostly',
      start_url: '/reservas',
      display: 'standalone',
    })
  })

  it('has the icons an install needs, and every one of them exists', () => {
    expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '512x512 maskable',
    ])
    for (const icon of manifest.icons) expect(existsSync(web(`public${icon.src}`))).toBe(true)
  })

  it('is linked from the page, with the icon for iPhones', () => {
    const html = readFileSync(web('index.html'), 'utf8')

    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
    expect(existsSync(web('public/apple-touch-icon.png'))).toBe(true)
  })
})
