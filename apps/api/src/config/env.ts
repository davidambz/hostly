import { isIP } from 'node:net'

import { z } from 'zod'

// `.env.example` ships every key with an empty value, so an empty string means "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema)

// Browsers send `Origin` as `scheme://host[:port]`, and CORS compares it verbatim,
// so anything else (a path, a trailing slash) would silently never match.
const isBareOrigin = (value: string) => URL.canParse(value) && new URL(value).origin === value

const origin = z.url({ protocol: /^https?$/ }).refine(isBareOrigin, {
  message: 'Expected a bare origin like https://app.example.com (no path or trailing slash)',
})

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')

/** proxy-addr's names for address ranges, accepted in a TRUST_PROXY list. */
const PROXY_RANGES = new Set(['loopback', 'linklocal', 'uniquelocal'])

const isProxyAddress = (value: string) => {
  if (PROXY_RANGES.has(value)) return true
  const [address = '', prefix, ...rest] = value.split('/')
  const version = isIP(address)
  if (version === 0 || rest.length > 0) return false
  if (prefix === undefined) return true
  const bits = Number(prefix)
  return /^\d+$/.test(prefix) && bits <= (version === 4 ? 32 : 128)
}

/**
 * Which proxies to believe about the client's address (x-forwarded-for): `false` (none),
 * a number of hops (`1` behind one load balancer), or the proxies' addresses and CIDRs
 * (`10.0.0.0/8,loopback`). `true` believes anyone, so anyone can pick their IP and slip
 * past the rate limits: only behind a proxy that overwrites the header.
 */
const trustProxy = z.union([
  booleanString,
  z
    .string()
    .regex(/^[1-9]\d{0,1}$/)
    .transform(Number),
  z
    .string()
    .transform((value) => value.split(',').map((item) => item.trim()))
    .pipe(
      z.array(z.string().refine(isProxyAddress, 'Expected an IP address, a CIDR or a range name')),
    ),
])

/** docker-compose's default JWT secret starts with this; production refuses it. */
export const DEV_JWT_SECRET_PREFIX = 'dev-only-'

const envSchema = z
  .object({
    // Defaults to production so a deploy that forgets NODE_ENV never runs in dev mode.
    NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('production')),
    HOST: optional(z.string().default('0.0.0.0')),
    PORT: optional(z.coerce.number().int().min(1).max(65_535).default(3333)),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: 'Expected a postgresql:// connection URL',
    }),
    LOG_LEVEL: optional(
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    ),
    CORS_ORIGINS: optional(
      z
        .string()
        .default('http://localhost:5173')
        .transform((value) => value.split(',').map((item) => item.trim()))
        .pipe(z.array(origin)),
    ),
    RATE_LIMIT_MAX: optional(z.coerce.number().int().positive().default(100)),
    /** Stricter per-minute limit for the auth routes (signup, login), against brute force. */
    AUTH_RATE_LIMIT_MAX: optional(z.coerce.number().int().positive().default(10)),
    // Behind a load balancer, set it so rate limiting and logs see the client's IP instead
    // of the proxy's. Required in production: both wrong ways (trusting no one behind a
    // proxy, or everyone without one) break the per-IP limits.
    TRUST_PROXY: optional(trustProxy.optional()),
    DOCS_ENABLED: optional(booleanString.optional()),
    /** Signs the access tokens (HS256). Generate with `openssl rand -base64 48`. */
    JWT_SECRET: z.string().min(32, 'Must have at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: optional(
      z.coerce
        .number()
        .int()
        .positive()
        .default(15 * 60),
    ),
    /** How long a session lasts without use: each refresh pushes the end this far ahead. */
    REFRESH_TOKEN_TTL_DAYS: optional(z.coerce.number().int().positive().default(30)),
    /** The most a session lasts from its login, however much it's used. */
    REFRESH_SESSION_MAX_DAYS: optional(z.coerce.number().int().positive().default(90)),
    /** Stripe's secret key (`sk_…`). Without it, checkout answers 503 BILLING_UNAVAILABLE. */
    STRIPE_SECRET_KEY: optional(z.string().startsWith('sk_').optional()),
    /** Signs Stripe's webhooks (`whsec_…`); `stripe listen` prints one for local work. */
    STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_').optional()),
    /** Where the web app lives, for Stripe to send the user back to. Defaults to the first CORS origin. */
    APP_URL: optional(origin.optional()),
    /** Send the refresh cookie only over HTTPS. Defaults to on in production. */
    COOKIE_SECURE: optional(booleanString.optional()),
  })
  .refine((env) => env.REFRESH_SESSION_MAX_DAYS >= env.REFRESH_TOKEN_TTL_DAYS, {
    path: ['REFRESH_SESSION_MAX_DAYS'],
    message: 'Must be at least REFRESH_TOKEN_TTL_DAYS',
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || !env.JWT_SECRET.startsWith(DEV_JWT_SECRET_PREFIX),
    {
      path: ['JWT_SECRET'],
      message: 'The development JWT secret must not be used in production',
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.STRIPE_SECRET_KEY === undefined ||
      env.STRIPE_WEBHOOK_SECRET !== undefined,
    {
      path: ['STRIPE_WEBHOOK_SECRET'],
      // Without it every webhook fails its signature check and no payment is ever confirmed.
      message: 'Required in production when STRIPE_SECRET_KEY is set',
    },
  )
  .refine((env) => env.NODE_ENV !== 'production' || env.TRUST_PROXY !== undefined, {
    path: ['TRUST_PROXY'],
    message:
      'Required in production: false without a proxy, the number of proxies (e.g. 1), or their addresses',
  })
  .transform(({ DOCS_ENABLED, COOKIE_SECURE, APP_URL, TRUST_PROXY, ...env }) => ({
    ...env,
    TRUST_PROXY: TRUST_PROXY ?? false,
    DOCS_ENABLED: DOCS_ENABLED ?? env.NODE_ENV !== 'production',
    COOKIE_SECURE: COOKIE_SECURE ?? env.NODE_ENV === 'production',
    APP_URL: APP_URL ?? env.CORS_ORIGINS[0] ?? 'http://localhost:5173',
  }))

export type Env = z.infer<typeof envSchema>

export class InvalidEnvError extends Error {
  constructor(error: z.ZodError) {
    super(`Invalid environment variables:\n${z.prettifyError(error)}`)
    this.name = 'InvalidEnvError'
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new InvalidEnvError(result.error)
  }
  return result.data
}
