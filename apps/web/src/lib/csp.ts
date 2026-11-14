/**
 * The Content-Security-Policy of the built app, as a <meta> tag (the API's address is only
 * known at build time). Scripts only from the app itself: an injected script, the one thing
 * that could read the access token in memory, doesn't run. Styles allow inline because the
 * UI components position themselves with style attributes. `frame-ancestors` can't live in
 * a <meta>; nginx sends it as a header. Stripe is the one outside party: its script and the
 * card fields' frames (js.stripe.com, hooks.stripe.com for the bank's check) and its API.
 */
export function contentSecurityPolicy(apiUrl: string): string {
  return [
    "default-src 'self'",
    "script-src 'self' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.stripe.com",
    "font-src 'self' data:",
    `connect-src 'self' ${new URL(apiUrl).origin} https://api.stripe.com`,
    'frame-src https://js.stripe.com https://hooks.stripe.com',
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
