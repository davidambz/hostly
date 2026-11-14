import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { GrantDuration, PlanGrant } from './api'

export const DURATIONS: { value: GrantDuration; label: string }[] = [
  { value: 'ONE_MONTH', label: '1 mês' },
  { value: 'SIX_MONTHS', label: '6 meses' },
  { value: 'ONE_YEAR', label: '1 ano' },
  { value: 'LIFETIME', label: 'Vitalício' },
]

export const ACTION_LABELS: Record<PlanGrant['events'][number]['action'], string> = {
  GRANTED: 'Concedido',
  RENEWED: 'Renovado',
  PLAN_CHANGED: 'Plano trocado',
  REVOKED: 'Revogado',
}

/** `14/12/2026`, or `para sempre` for a lifetime grant. */
export function untilLabel(endsAt: string | null): string {
  return endsAt === null ? 'para sempre' : format(new Date(endsAt), 'dd/MM/yyyy', { locale: ptBR })
}

/** `14/11/2026 às 10:32`. */
export function momentLabel(at: string): string {
  return format(new Date(at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}
