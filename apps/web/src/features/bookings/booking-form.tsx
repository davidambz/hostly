import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, MessageCircle, Trash2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { FormError } from '@/components/form/form-error'
import { withMask } from '@/components/form/mask'
import { SelectField } from '@/components/form/select-field'
import { TextField } from '@/components/form/text-field'
import { TextareaField } from '@/components/form/textarea-field'
import { Button } from '@/components/ui/button'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ApiError } from '@/lib/api/errors'
import { applyApiError } from '@/lib/api/form-errors'
import { maskMoney, maskPercent } from '@/lib/money'
import { maskPhone } from '@hostly/validation'

import type { BookingInput, QuoteInput } from './api'
import {
  type BookingFormValues,
  bookingFormSchema,
  toBookingInput,
  toQuoteInput,
  whatsAppLink,
  type BookingDefaults,
  defaultsToFill,
} from './booking-schema'
import { DateRangeField } from './date-range-field'
import { formatShortDate } from './dates'
import { FinancialSummary, QUOTE_DEBOUNCE_MS } from './financial-summary'

interface Option {
  value: string
  label: string
}

const API_FIELD_MESSAGES = {
  propertyId: 'Imóvel inválido.',
  brokerId: 'Intermediador inválido.',
  guestName: 'Nome inválido.',
  guestPhone: 'Telefone inválido.',
  notes: 'Observações inválidas.',
  checkIn: 'Data inválida.',
  checkOut: 'Data inválida.',
  nightlyRate: 'Diária inválida.',
  cleaningFee: 'Valor inválido.',
  discount: 'Desconto inválido.',
  amountPaid: 'Valor inválido.',
  brokerCommissionBps: 'Comissão inválida.',
}

/** The dates of the booking a 409 says these nights overlap, when the API sends them. */
function overlapMessage(details: unknown): string {
  const stay = details as { checkIn?: unknown; checkOut?: unknown } | null | undefined
  if (typeof stay?.checkIn === 'string' && typeof stay.checkOut === 'string') {
    return `Já há uma reserva neste imóvel com entrada em ${formatShortDate(stay.checkIn)} e saída em ${formatShortDate(stay.checkOut)}.`
  }
  return 'O imóvel já está reservado em algumas dessas noites.'
}

export function BookingForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  properties,
  brokers,
  bookingId,
  fallbackMonth,
  defaults,
}: {
  defaultValues: BookingFormValues
  /** The choices, loaded before the form: a native select drops a value it has no option for. */
  properties: Option[]
  brokers: Option[]
  submitLabel: string
  onSubmit: (input: BookingInput) => Promise<unknown>
  onCancel: () => void
  /** Shown when editing. */
  onDelete?: () => void
  /** The booking being edited, whose own nights don't count as taken. */
  bookingId?: string
  /** Where the date picker opens when there are no dates yet. */
  fallbackMonth?: string
  /** Values a property or broker brings along when picked. */
  defaults?: BookingDefaults
}) {
  const form = useForm<BookingFormValues, unknown, ReturnType<typeof bookingFormSchema.parse>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues,
  })
  const { errors, isSubmitting } = form.formState
  const values = useWatch({ control: form.control }) as BookingFormValues
  const whatsApp = whatsAppLink(values.guestPhone)

  // The quote follows the form, once it stops changing. Compared as text: the values
  // object is new on every render.
  const quoteKey = JSON.stringify(toQuoteInput(values))
  const debouncedKey = useDebouncedValue(quoteKey, QUOTE_DEBOUNCE_MS)
  const quoteInput = useMemo(() => JSON.parse(debouncedKey) as QuoteInput | null, [debouncedKey])

  const submit = form.handleSubmit(async (parsed) => {
    try {
      await onSubmit(toBookingInput(parsed))
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BOOKING_OVERLAP') {
        form.setError('checkIn', { type: 'server', message: overlapMessage(error.details) })
        return
      }
      applyApiError(error, form.setError, API_FIELD_MESSAGES)
    }
  })

  const money = (name: 'nightlyRate' | 'cleaningFee' | 'discount' | 'amountPaid') =>
    withMask(form.register(name), maskMoney)

  /**
   * Picking a property or broker brings its defaults into the fields not typed in. The
   * previous pick is remembered here: by the time a change is seen, the form holds the new one.
   */
  useEffect(() => {
    if (!defaults) return
    const previous = {
      propertyId: form.getValues('propertyId'),
      brokerId: form.getValues('brokerId'),
    }
    return form.subscribe({
      name: ['propertyId', 'brokerId'],
      formState: { values: true },
      callback: ({ name, type }) => {
        if (type !== 'change' || (name !== 'propertyId' && name !== 'brokerId')) return
        const nextId = form.getValues(name)
        const fill = defaultsToFill(form.getValues(), defaults, {
          field: name,
          previousId: previous[name],
          nextId,
        })
        previous[name] = nextId
        for (const [field, value] of Object.entries(fill) as [keyof typeof fill, string][]) {
          form.setValue(field, value)
        }
      },
    })
  }, [form, defaults])

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      <FormError message={errors.root?.message} />

      <SelectField
        label="Imóvel"
        emptyLabel="Escolha o imóvel"
        options={properties}
        error={errors.propertyId?.message}
        {...form.register('propertyId')}
      />

      <TextField
        label="Hóspede"
        placeholder="Nome de quem reservou"
        autoComplete="off"
        error={errors.guestName?.message}
        {...form.register('guestName')}
      />

      <div className="grid gap-2">
        <TextField
          label="Telefone do hóspede"
          type="tel"
          placeholder="ex.: (48) 99999-0000"
          error={errors.guestPhone?.message}
          {...withMask(form.register('guestPhone'), maskPhone)}
        />
        {whatsApp && (
          <a
            href={whatsApp}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex w-fit items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
          >
            <MessageCircle className="size-4" aria-hidden />
            Abrir no WhatsApp
          </a>
        )}
      </div>

      <Controller
        control={form.control}
        name="checkIn"
        render={({ field }) => (
          <DateRangeField
            checkIn={field.value}
            checkOut={values.checkOut}
            propertyId={values.propertyId || undefined}
            exceptBookingId={bookingId}
            fallbackMonth={fallbackMonth}
            error={errors.checkIn?.message ?? errors.checkOut?.message}
            onChange={({ checkIn, checkOut }) => {
              field.onChange(checkIn)
              form.setValue('checkOut', checkOut)
              form.clearErrors(['checkIn', 'checkOut'])
            }}
          />
        )}
      />

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          label="Diária"
          inputMode="numeric"
          placeholder="R$"
          error={errors.nightlyRate?.message}
          {...money('nightlyRate')}
        />
        <TextField
          label="Limpeza"
          inputMode="numeric"
          placeholder="R$"
          error={errors.cleaningFee?.message}
          {...money('cleaningFee')}
        />
        <TextField
          label="Desconto"
          inputMode="numeric"
          placeholder="R$"
          error={errors.discount?.message}
          {...money('discount')}
        />
        <TextField
          label="Valor já pago"
          inputMode="numeric"
          placeholder="R$"
          error={errors.amountPaid?.message}
          {...money('amountPaid')}
        />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-[1fr_8rem]">
        <SelectField
          label="Intermediador"
          emptyLabel="Sem intermediador"
          options={brokers}
          error={errors.brokerId?.message}
          {...form.register('brokerId', {
            onChange: (event: { target: { value: string } }) => {
              // No broker, no commission.
              if (event.target.value === '') form.setValue('brokerCommissionBps', '')
            },
          })}
        />
        <TextField
          label="Comissão (%)"
          inputMode="decimal"
          placeholder="0"
          disabled={!values.brokerId}
          hint={values.brokerId ? 'Sobre as diárias, sem a limpeza.' : undefined}
          error={errors.brokerCommissionBps?.message}
          {...withMask(form.register('brokerCommissionBps'), maskPercent)}
        />
      </div>

      <TextareaField
        label="Observações"
        placeholder="Horário de chegada, quantas pessoas, pet…"
        maxLength={2000}
        error={errors.notes?.message}
        {...form.register('notes')}
      />

      <FinancialSummary input={quoteInput} />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isSubmitting}
          >
            <Trash2 aria-hidden />
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
