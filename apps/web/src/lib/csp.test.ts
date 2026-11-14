import { contentSecurityPolicy } from './csp'

describe('contentSecurityPolicy', () => {
  it("runs only the app's own scripts and talks only to itself and the API", () => {
    const policy = contentSecurityPolicy('https://api.hostly.app/v1')

    expect(policy).toContain("script-src 'self' https://js.stripe.com https://*.js.stripe.com;")
    expect(policy).not.toMatch(/script-src[^;]*unsafe/)
    expect(policy).toContain("connect-src 'self' https://api.hostly.app https://api.stripe.com;")
    expect(policy).toContain(
      'frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com',
    )
    expect(policy).toContain("object-src 'none'")
  })
})
