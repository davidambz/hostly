import { CalendarDays } from 'lucide-react'

import { PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/states'

/** Replaced by the calendar and list views in #18. */
export function BookingsPage() {
  return (
    <>
      <PageHeader
        title="Reservas"
        description="Os aluguéis de cada imóvel, no calendário ou em lista."
      />
      <EmptyState
        icon={CalendarDays}
        title="Em construção"
        description="O calendário de reservas chega em breve."
      />
    </>
  )
}
