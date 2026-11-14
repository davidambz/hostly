import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormError } from '@/components/form/form-error'
import { withMask } from '@/components/form/mask'
import { TextField } from '@/components/form/text-field'
import { TextareaField } from '@/components/form/textarea-field'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { applyApiError } from '@/lib/api/form-errors'
import { maskMoney } from '@/lib/money'

import { type Plan, useCreatePlan, useUpdatePlan } from './api'
import {
  EMPTY_PLAN_FORM,
  type PlanFormValues,
  planFormSchema,
  toPlanFormValues,
  toPlanInput,
} from './plan-schema'

const API_FIELD_MESSAGES = {
  name: 'Nome inválido.',
  description: 'Descrição inválida.',
  maxProperties: 'Limite inválido.',
  monthlyPrice: 'Preço inválido.',
  semiannualPrice: 'Preço inválido.',
  annualPrice: 'Preço inválido.',
}

/** Creates a plan, or edits `plan` when given, in a side panel. */
export function PlanSheet({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: Plan
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{plan ? 'Editar plano' : 'Novo plano'}</SheetTitle>
          <SheetDescription>
            Preços em reais; deixe uma periodicidade em branco para não oferecê-la.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {/* Remounted per plan, so the form starts from its values. */}
          <PlanForm
            key={plan?.id ?? 'new'}
            plan={plan}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function PlanForm({ plan, onDone }: { plan?: Plan; onDone: () => void }) {
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const free = plan?.code === 'free'
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: plan ? toPlanFormValues(plan) : EMPTY_PLAN_FORM,
  })
  const { errors, isSubmitting } = form.formState
  const money = (name: 'monthlyPrice' | 'semiannualPrice' | 'annualPrice') =>
    withMask(form.register(name), maskMoney)

  const submit = form.handleSubmit(async (values) => {
    try {
      const input = toPlanInput(values)
      if (plan) {
        // Free has no prices: they aren't sent, so the API never has to refuse them.
        const { monthlyPrice, semiannualPrice, annualPrice, ...rest } = input
        await update.mutateAsync({
          id: plan.id,
          input: free ? rest : { ...rest, monthlyPrice, semiannualPrice, annualPrice },
        })
        toast.success('Plano salvo.')
      } else {
        await create.mutateAsync(input)
        toast.success('Plano criado.')
      }
      onDone()
    } catch (error) {
      applyApiError(error, form.setError, API_FIELD_MESSAGES)
    }
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-4">
      <FormError message={errors.root?.message} />
      <TextField label="Nome" error={errors.name?.message} {...form.register('name')} />
      <TextareaField
        label="Descrição"
        placeholder="O que o plano dá, em uma ou duas frases."
        maxLength={1000}
        error={errors.description?.message}
        {...form.register('description')}
      />
      <TextField
        label="Limite de imóveis"
        inputMode="numeric"
        placeholder="Ilimitados"
        hint="Em branco: imóveis ilimitados."
        error={errors.maxProperties?.message}
        {...form.register('maxProperties')}
      />
      {free ? (
        <p className="text-muted-foreground text-sm">O plano Free é sempre de graça.</p>
      ) : (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Preços</legend>
          <div className="grid items-start gap-4 sm:grid-cols-3">
            <TextField
              label="Mensal"
              inputMode="numeric"
              placeholder="R$"
              error={errors.monthlyPrice?.message}
              {...money('monthlyPrice')}
            />
            <TextField
              label="Semestral"
              inputMode="numeric"
              placeholder="R$"
              error={errors.semiannualPrice?.message}
              {...money('semiannualPrice')}
            />
            <TextField
              label="Anual"
              inputMode="numeric"
              placeholder="R$"
              error={errors.annualPrice?.message}
              {...money('annualPrice')}
            />
          </div>
        </fieldset>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {plan ? 'Salvar' : 'Criar plano'}
        </Button>
      </div>
    </form>
  )
}
