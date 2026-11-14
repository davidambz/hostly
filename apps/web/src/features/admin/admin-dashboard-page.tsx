import { Link } from 'react-router'

import { ErrorState, LoadingState } from '@/components/states'
import { errorMessage } from '@/lib/api/form-errors'

import { type AdminDashboard, useAdminDashboard } from './api'
import { untilLabel } from './grant-labels'

/** The backoffice at a glance: accounts, plans, grants ending soon, usage. */
export function AdminDashboardPage() {
  const dashboard = useAdminDashboard()
  if (dashboard.isPending) return <LoadingState rows={3} />
  if (dashboard.isError) {
    return (
      <ErrorState
        message={errorMessage(dashboard.error)}
        onRetry={() => void dashboard.refetch()}
      />
    )
  }
  return <Figures data={dashboard.data} />
}

function Figures({ data }: { data: AdminDashboard }) {
  const figures = [
    { label: 'Contas', value: data.users.total },
    { label: 'Novas em 30 dias', value: data.users.new },
    { label: 'Imóveis', value: data.usage.properties },
    { label: 'Reservas', value: data.usage.bookings },
  ]
  return (
    <div className="grid gap-8">
      <dl className="bg-grid-line grid grid-cols-2 gap-px overflow-hidden rounded-md border sm:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-card grid gap-1 p-4">
            <dt className="text-muted-foreground text-sm">{figure.label}</dt>
            <dd className="font-wide text-2xl font-semibold tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="by-plan" className="grid content-start gap-3">
          <h2 id="by-plan" className="font-wide text-lg font-semibold">
            Contas por plano
          </h2>
          <ul className="divide-y rounded-md border">
            {data.byPlan.map((plan) => (
              <li key={plan.id} className="flex justify-between gap-4 p-3 text-sm">
                <span>{plan.name}</span>
                <span className="font-medium tabular-nums">{plan.users}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            {data.bySource.grant === 1
              ? '1 conta com plano de cortesia.'
              : `${String(data.bySource.grant)} contas com plano de cortesia.`}
          </p>
        </section>

        <section aria-labelledby="ending-soon" className="grid content-start gap-3">
          <h2 id="ending-soon" className="font-wide text-lg font-semibold">
            Cortesias que vencem em 30 dias
          </h2>
          {data.grantsEndingSoon.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma cortesia vence nos próximos 30 dias.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {data.grantsEndingSoon.map((grant) => (
                <li
                  key={grant.grantId}
                  className="flex flex-wrap justify-between gap-2 p-3 text-sm"
                >
                  <span>
                    <span className="font-medium">{grant.user.name}</span>
                    <span className="text-muted-foreground"> · {grant.plan.name}</span>
                  </span>
                  <span className="tabular-nums">até {untilLabel(grant.endsAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/admin/usuarios"
            className="text-primary w-fit text-sm font-medium hover:underline"
          >
            Ir para as contas
          </Link>
        </section>
      </div>
    </div>
  )
}
