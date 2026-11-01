import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { type Property, useCreateProperty, useUpdateProperty } from './api'
import { PropertyForm } from './property-form'
import { EMPTY_PROPERTY_FORM, toFormValues } from './property-schema'

/** Creates a property, or edits `property` when given, in a side panel. */
export function PropertySheet({
  open,
  onOpenChange,
  property,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  property?: Property
}) {
  const create = useCreateProperty()
  const update = useUpdateProperty()
  const editing = property !== undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editing ? 'Editar imóvel' : 'Novo imóvel'}</SheetTitle>
          <SheetDescription>
            {editing ? 'Altere os dados e salve.' : 'Só o nome e o tipo são obrigatórios.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {/* Remounted per property, so the form starts from that property's values. */}
          <PropertyForm
            key={property?.id ?? 'new'}
            defaultValues={property ? toFormValues(property) : EMPTY_PROPERTY_FORM}
            submitLabel={editing ? 'Salvar' : 'Cadastrar imóvel'}
            onCancel={() => {
              onOpenChange(false)
            }}
            onSubmit={async (input) => {
              if (property) {
                await update.mutateAsync({ id: property.id, input })
                toast.success('Imóvel atualizado.')
              } else {
                await create.mutateAsync(input)
                toast.success('Imóvel cadastrado.')
              }
              onOpenChange(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
