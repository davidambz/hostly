import { z } from 'zod'

/** R$ 10 million, in cents: far above any real stay, well inside a 32-bit integer. */
export const MAX_AMOUNT_CENTS = 1_000_000_000

/** An amount in cents. */
export const centsSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS)

/** Basis points: 1000 = 10%. */
export const bpsSchema = z.number().int().min(0).max(10_000)

/** An optional amount; `null` (or leaving it out) means none. */
export const optionalCentsSchema = centsSchema.nullish().transform((value) => value ?? null)

/** An optional percentage in basis points; `null` (or leaving it out) means none. */
export const optionalBpsSchema = bpsSchema.nullish().transform((value) => value ?? null)
