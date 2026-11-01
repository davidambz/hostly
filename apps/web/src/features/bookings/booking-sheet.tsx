import { toast } from 'sonner'

import { ErrorState, LoadingState } from '@/components/states'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { errorMessage } from '@/lib/api/form-errors'

import { useAllBrokers } from '../brokers/api'
import { useAllProperties } from '../properties/api'
import { type Booking, useCreateBooking, useUpdateBooking } from './api'
import { BookingForm } from './booking-form'
import { type BookingFormValues, emptyBookingForm, toFormValues } from './booking-schema'

/** What a new booking starts with: the property filtered on, the days picked. */
export type BookingDraft = Partial<Pick<BookingFormValues, 'propertyId' | 'checkIn' | 'checkOut'>>

/** Creates a booking (from `draft`), or edits `booking` when given, in a side panel. */
export function BookingSheet({
  open,
  onOpenChange,
  booking,
  draft,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking?: Booking
  draft?: BookingDraft
  onDelete: (booking: Booking) => void
}) {
  const create = useCreateBooking()
  const update = useUpdateBooking()
  const properties = useAllProperties()
  const brokers = useAllBrokers()
  const toOptions = (items: { id: string; name: string }[] = []) =>
    items.map((item) => ({ value: item.id, label: item.name }))
  const failed = properties.isError ? properties : brokers.isError ? brokers : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{booking ? 'Editar reserva' : 'Nova reserva'}</SheetTitle>
          <SheetDescription>
            {booking
              ? `${booking.guestName} em ${booking.property.name}.`
              : 'O resumo mostra os valores enquanto você preenche.'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {failed ? (
            <ErrorState
              message={errorMessage(failed.error)}
              onRetry={() => void failed.refetch()}
            />
          ) : properties.isPending || brokers.isPending ? (
            <LoadingState />
          ) : (
            /* Remounted per booking (or draft), so the form starts from its values. */
            <BookingForm
              properties={toOptions(properties.data)}
              brokers={toOptions(brokers.data)}
              key={booking?.id ?? `new-${JSON.stringify(draft ?? {})}`}
              defaultValues={booking ? toFormValues(booking) : emptyBookingForm(draft)}
              submitLabel={booking ? 'Salvar' : 'Criar reserva'}
              onCancel={() => {
                onOpenChange(false)
              }}
              onDelete={
                booking
                  ? () => {
                      onDelete(booking)
                    }
                  : undefined
              }
              onSubmit={async (input) => {
                if (booking) {
                  await update.mutateAsync({ id: booking.id, input })
                  toast.success('Reserva atualizada.')
                } else {
                  await create.mutateAsync(input)
                  toast.success('Reserva criada.')
                }
                onOpenChange(false)
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
