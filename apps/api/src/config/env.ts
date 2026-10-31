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

const envSchema = z
  .object({
    // Defaults to production so a deploy that forgets NODE_ENV never runs in dev mode.
    NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('production')),
    HOST: optional(z.string().default('0.0.0.0')),
    PORT: optional(z.coerce.number().int().min(1).max(65_535).default(3333)),
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
    // Turn on behind a load balancer so rate limiting and logs see the client IP
    // (from x-forwarded-for) instead of the proxy's.
    TRUST_PROXY: optional(booleanString.default(false)),
    DOCS_ENABLED: optional(booleanString.optional()),
  })
  .transform(({ DOCS_ENABLED, ...env }) => ({
    ...env,
    DOCS_ENABLED: DOCS_ENABLED ?? env.NODE_ENV !== 'production',
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
