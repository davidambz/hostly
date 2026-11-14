import { PageHeader } from '@/components/page-header'
import { ErrorState, LoadingState } from '@/components/states'
import { errorMessage } from '@/lib/api/form-errors'

import { useMyPlan } from './api'
import { sourceLabel, usageLabel } from './plan-labels'

/** The user's plan: what it is, where it comes from, and how much of it is used. */
export function PlanPage() {
  const myPlan = useMyPlan()

  return (
    <>
      <PageHeader title="Meu plano" description="O que o seu plano permite e quanto você usa." />
      {myPlan.isPending ? (
        <LoadingState rows={1} />
      ) : myPlan.isError ? (
        <ErrorState message={errorMessage(myPlan.error)} onRetry={() => void myPlan.refetch()} />
      ) : (
        <section
          aria-labelledby="my-plan-title"
          className="bg-card grid max-w-2xl gap-4 rounded-md border p-5"
        >
          <div className="grid gap-1">
            <h2 id="my-plan-title" className="font-wide text-2xl font-bold">
              {myPlan.data.plan.name}
            </h2>
            {myPlan.data.plan.description && (
              <p className="text-muted-foreground">{myPlan.data.plan.description}</p>
            )}
            {sourceLabel(myPlan.data) && (
              <p className="text-sm font-medium">{sourceLabel(myPlan.data)}</p>
            )}
          </div>
          <dl className="grid gap-1">
            <dt className="text-muted-foreground text-sm">Imóveis</dt>
            <dd className="font-wide text-xl font-semibold tabular-nums">
              {usageLabel(myPlan.data)}
            </dd>
          </dl>
          {!myPlan.data.canAddProperty && (
            <p className="text-sm">
              Você chegou ao limite do seu plano. Seus imóveis continuam todos aqui; para cadastrar
              mais, é preciso o Premium.
            </p>
          )}
        </section>
      )}
    </>
  )
}
