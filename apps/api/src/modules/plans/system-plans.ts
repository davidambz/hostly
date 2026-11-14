import type { Database } from '../../shared/database.js'

/** Codes of the plans the system relies on. */
export const FREE_PLAN = 'free'
export const PREMIUM_PLAN = 'premium'

/**
 * The plans every installation has, exactly as the migration that created them inserts
 * them. Integration tests empty every table and put these back with `seedSystemPlans`.
 */
export const SYSTEM_PLANS = [
  {
    code: FREE_PLAN,
    name: 'Free',
    description: 'Para começar: um imóvel, de graça, sem prazo.',
    maxProperties: 1,
  },
  {
    code: PREMIUM_PLAN,
    name: 'Premium',
    description: 'Imóveis ilimitados e tudo o que o Hostly tem.',
    maxProperties: null,
  },
] as const

export async function seedSystemPlans(db: Database): Promise<void> {
  await db.plan.createMany({ data: [...SYSTEM_PLANS], skipDuplicates: true })
}
