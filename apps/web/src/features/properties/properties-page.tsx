import { Home } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/states'

/** Replaced by the properties list in #16. */
export function PropertiesPage() {
  return (
    <>
      <PageHeader title="Imóveis" description="As casas e apartamentos que você aluga." />
      <EmptyState
        icon={Home}
        title="Em construção"
        description="O cadastro de imóveis chega em breve."
      />
    </>
  )
}
