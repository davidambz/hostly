import { z } from 'zod'

export const livenessSchema = z.object({
  status: z.literal('ok'),
})

export const componentStatusSchema = z.enum(['up', 'down'])

export const readinessSchema = z.object({
  status: z.enum(['ready', 'unavailable']),
  checks: z.object({ database: componentStatusSchema }),
})

export type ComponentStatus = z.infer<typeof componentStatusSchema>
export type Readiness = z.infer<typeof readinessSchema>
