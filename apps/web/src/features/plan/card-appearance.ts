import type { Appearance, CssFontSource, CustomFontSource } from '@stripe/stripe-js'
import archivo from '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?url'

/** A theme token's value as the page has it now (light or dark). */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}

/**
 * Stripe's card fields dressed as the app's own: the theme's colors, the Archivo face, the
 * same corners, field stroke and focus ring. Read from the live tokens, so it follows the
 * theme.
 */
export function cardAppearance(dark: boolean): Appearance {
  const ring = token('ring')
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: token('primary'),
      colorBackground: token('card'),
      colorText: token('foreground'),
      colorTextSecondary: token('muted-foreground'),
      colorTextPlaceholder: token('muted-foreground'),
      colorDanger: token('destructive'),
      fontFamily: "'Archivo Variable', system-ui, sans-serif",
      fontSizeBase: '14px',
      borderRadius: '6px',
      spacingUnit: '4px',
    },
    rules: {
      '.Label': { fontWeight: '500', color: token('foreground'), marginBottom: '6px' },
      '.Input': { border: `1px solid ${token('input')}`, boxShadow: 'none' },
      '.Input:focus': { borderColor: ring, boxShadow: `0 0 0 2px ${ring}` },
      '.Input--invalid': { borderColor: token('destructive') },
      '.Error': { color: token('destructive') },
    },
  }
}

/** The app's face for the card fields, loaded by Stripe from this site. */
export function cardFonts(): (CssFontSource | CustomFontSource)[] {
  return [
    {
      family: 'Archivo Variable',
      src: `url(${new URL(archivo, window.location.origin).href})`,
      weight: '100 900',
      display: 'swap',
    },
  ]
}
