import { Link } from 'react-router'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { MyPlan } from './api'

/** Said instead of opening the new-property form when the plan has no room for another. */
export function PlanLimitDialog({
  plan,
  open,
  onOpenChange,
}: {
  plan?: MyPlan
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const limit = plan?.plan.maxProperties ?? 0
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Seu plano não tem espaço para mais imóveis</AlertDialogTitle>
          <AlertDialogDescription>
            O {plan?.plan.name ?? 'seu plano'} permite{' '}
            {limit === 1 ? '1 imóvel' : `${String(limit)} imóveis`}. Com o Premium, os imóveis são
            ilimitados. Nenhum imóvel seu é apagado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Agora não</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link to="/plano">Ver meu plano</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
