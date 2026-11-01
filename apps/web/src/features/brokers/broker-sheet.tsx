import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { type Broker, useCreateBroker, useUpdateBroker } from './api'
import { BrokerForm } from './broker-form'
import { EMPTY_BROKER_FORM, toFormValues } from './broker-schema'

/** Creates a broker, or edits `broker` when given, in a side panel. */
export function BrokerSheet({
  open,
  onOpenChange,
  broker,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  broker?: Broker
}) {
  const create = useCreateBroker()
  const update = useUpdateBroker()
  const editing = broker !== undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? 'Editar intermediador' : 'Novo intermediador'}</SheetTitle>
          <SheetDescription>
            {editing ? 'Altere os dados e salve.' : 'Só o tipo e o nome são obrigatórios.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {/* Remounted per broker, so the form starts from that broker's values. */}
          <BrokerForm
            key={broker?.id ?? 'new'}
            defaultValues={broker ? toFormValues(broker) : EMPTY_BROKER_FORM}
            submitLabel={editing ? 'Salvar' : 'Cadastrar intermediador'}
            onCancel={() => {
              onOpenChange(false)
            }}
            onSubmit={async (input) => {
              if (broker) {
                await update.mutateAsync({ id: broker.id, input })
                toast.success('Intermediador atualizado.')
              } else {
                await create.mutateAsync(input)
                toast.success('Intermediador cadastrado.')
              }
              onOpenChange(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
