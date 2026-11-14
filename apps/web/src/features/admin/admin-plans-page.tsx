import { MoreHorizontal, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'

import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOverlay } from '@/hooks/use-overlay'
import { errorMessage } from '@/lib/api/form-errors'
import { formatBRL } from '@/lib/money'

import { type Plan, useAdminPlans, useUpdatePlan } from './api'
import { PlanSheet } from './plan-sheet'
import { propertyLimitLabel } from './plan-schema'

const price = (cents: number | null) => (cents === null ? '—' : formatBRL(cents))

/** The plans: what each allows, what it costs per period, and whether it is on sale. */
export function AdminPlansPage() {
  const plans = useAdminPlans()
  const update = useUpdatePlan()
  const editing = useOverlay<Plan>()

  const toggle = async (plan: Plan) => {
    try {
      await update.mutateAsync({ id: plan.id, input: { active: !plan.active } })
      toast.success(plan.active ? `${plan.name} saiu de venda.` : `${plan.name} voltou à venda.`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <Button
          onClick={() => {
            editing.show()
          }}
        >
          <Plus aria-hidden />
          Novo plano
        </Button>
      </div>

      {plans.isPending ? (
        <LoadingState rows={2} />
      ) : plans.isError ? (
        <ErrorState message={errorMessage(plans.error)} onRetry={() => void plans.refetch()} />
      ) : (
        <div className="rounded-lg border">
          <Table aria-label="Planos">
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Imóveis</TableHead>
                <TableHead className="hidden text-right md:table-cell">Mensal</TableHead>
                <TableHead className="hidden text-right md:table-cell">Semestral</TableHead>
                <TableHead className="hidden text-right md:table-cell">Anual</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.data.map((plan) => (
                <TableRow
                  key={plan.id}
                  className={plan.active ? undefined : 'text-muted-foreground'}
                >
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {!plan.active && <Badge variant="outline">Fora de venda</Badge>}
                    </div>
                    {plan.description && (
                      <div className="text-muted-foreground max-w-md truncate text-xs">
                        {plan.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{propertyLimitLabel(plan.maxProperties)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {price(plan.monthlyPrice)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {price(plan.semiannualPrice)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {price(plan.annualPrice)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Ações de ${plan.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            editing.show(plan)
                          }}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        {plan.code !== 'free' && (
                          <DropdownMenuItem onSelect={() => void toggle(plan)}>
                            {plan.active ? (
                              <PowerOff className="size-4" />
                            ) : (
                              <Power className="size-4" />
                            )}
                            {plan.active ? 'Tirar de venda' : 'Pôr à venda'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PlanSheet open={editing.open} plan={editing.item} onOpenChange={editing.setOpen} />
    </>
  )
}
