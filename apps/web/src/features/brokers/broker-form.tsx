import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ChangeEvent, useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { FormError } from '@/components/form/form-error'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { applyApiError } from '@/lib/api/form-errors'
import { maskPhone } from '@/lib/validation/brazil'

import { BROKER_TYPE_LABELS, type BrokerInput, type BrokerType } from './api'
import {
  type BrokerFormValues,
  brokerFormSchema,
  maskDocument,
  toBrokerInput,
} from './broker-schema'

const API_FIELD_MESSAGES = {
  name: 'Nome inválido.',
  email: 'E-mail inválido.',
  document: 'Documento inválido.',
  mobilePhone: 'Celular inválido.',
  landlinePhone: 'Telefone fixo inválido.',
}

const DOCUMENT_FIELD: Record<BrokerType, { label: string; placeholder: string; hint?: string }> = {
  INDIVIDUAL: { label: 'CPF', placeholder: '000.000.000-00' },
  COMPANY: {
    label: 'CNPJ',
    placeholder: '00.000.000/0000-00',
    hint: 'Aceita o CNPJ alfanumérico (com letras).',
  },
}

/** Keeps the mask applied while typing, without moving the caret when nothing changes. */
function masked(
  mask: (value: string) => string,
  onChange: (event: ChangeEvent<HTMLInputElement>) => unknown,
) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    const value = mask(event.target.value)
    if (event.target.value !== value) event.target.value = value
    void onChange(event)
  }
}

export function BrokerForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues: BrokerFormValues
  submitLabel: string
  onSubmit: (input: BrokerInput) => Promise<unknown>
  onCancel: () => void
}) {
  const form = useForm<BrokerFormValues, unknown, ReturnType<typeof brokerFormSchema.parse>>({
    resolver: zodResolver(brokerFormSchema),
    defaultValues,
  })
  const { errors, isSubmitting } = form.formState
  const type = useWatch({ control: form.control, name: 'type' })
  const typeLabelId = useId()
  const documentField = DOCUMENT_FIELD[type]

  const document = form.register('document')
  const mobilePhone = form.register('mobilePhone')
  const landlinePhone = form.register('landlinePhone')

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(toBrokerInput(values))
    } catch (error) {
      applyApiError(error, form.setError, API_FIELD_MESSAGES)
    }
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      <FormError message={errors.root?.message} />

      <div className="grid gap-2">
        <Label id={typeLabelId}>Tipo</Label>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              aria-labelledby={typeLabelId}
              value={field.value}
              onValueChange={(value: BrokerType) => {
                field.onChange(value)
                // Same characters, the other mask; check it again if it was already checked.
                form.setValue('document', maskDocument(value, form.getValues('document')))
                if (form.formState.errors.document) void form.trigger('document')
              }}
              className="flex gap-6"
            >
              {(['INDIVIDUAL', 'COMPANY'] as const).map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value={value} />
                  {BROKER_TYPE_LABELS[value]}
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </div>

      <TextField
        label="Nome"
        placeholder={type === 'INDIVIDUAL' ? 'Maria Corretora' : 'Imobiliária Litoral'}
        autoFocus
        error={errors.name?.message}
        {...form.register('name')}
      />

      <TextField
        label={documentField.label}
        placeholder={documentField.placeholder}
        hint={documentField.hint}
        autoCapitalize="characters"
        error={errors.document?.message}
        {...document}
        onChange={masked((value) => maskDocument(type, value), document.onChange)}
      />

      <TextField
        label="E-mail"
        type="email"
        autoComplete="off"
        placeholder="contato@exemplo.com"
        error={errors.email?.message}
        {...form.register('email')}
      />

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          label="Celular"
          type="tel"
          placeholder="(48) 99999-0000"
          error={errors.mobilePhone?.message}
          {...mobilePhone}
          onChange={masked(maskPhone, mobilePhone.onChange)}
        />
        <TextField
          label="Telefone fixo"
          type="tel"
          placeholder="(48) 3333-4444"
          error={errors.landlinePhone?.message}
          {...landlinePhone}
          onChange={masked(maskPhone, landlinePhone.onChange)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
