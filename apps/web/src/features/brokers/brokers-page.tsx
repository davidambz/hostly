import { Users } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/states'

/** Replaced by the brokers list in #17. */
export function BrokersPage() {
  return (
    <>
      <PageHeader
        title="Intermediadores"
        description="Corretores e imobiliárias que trazem reservas."
      />
      <EmptyState
        icon={Users}
        title="Em construção"
        description="O cadastro de intermediadores chega em breve."
      />
    </>
  )
}
