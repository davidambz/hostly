import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { FormError } from '@/components/form/form-error'
import { applyMask } from '@/components/form/mask'
import { SelectField } from '@/components/form/select-field'
import { TextField } from '@/components/form/text-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { applyApiError } from '@/lib/api/form-errors'
import { isValidCep, maskCep, onlyDigits, STATES } from '@hostly/validation'
import { lookupCep } from '@/lib/viacep'

import { PROPERTY_TYPE_LABELS, type PropertyInput } from './api'
import { type PropertyFormValues, propertyFormSchema, toPropertyInput } from './property-schema'

const STATE_OPTIONS = STATES.map((uf) => ({ value: uf, label: uf }))

const API_FIELD_MESSAGES = {
  name: 'Nome inválido.',
  zipCode: 'CEP inválido.',
  state: 'UF inválida.',
  unit: 'Só apartamentos têm unidade.',
  building: 'Só apartamentos têm edifício.',
  block: 'Só apartamentos têm bloco.',
}

type CepStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

const CEP_HINTS: Record<CepStatus, string | undefined> = {
  idle: 'Digite o CEP para preencher o endereço.',
  loading: 'Buscando endereço…',
  found: 'Endereço preenchido a partir do CEP.',
  'not-found': 'CEP não encontrado. Preencha o endereço à mão.',
  error: 'Não foi possível buscar o CEP agora. Preencha o endereço à mão.',
}

export function PropertyForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues: PropertyFormValues
  submitLabel: string
  onSubmit: (input: PropertyInput) => Promise<unknown>
  onCancel: () => void
}) {
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues,
  })
  const { errors, isSubmitting } = form.formState
  const type = useWatch({ control: form.control, name: 'type' })
  const typeLabelId = useId()
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const lookup = useRef<AbortController | null>(null)

  useEffect(() => () => lookup.current?.abort(), [])

  /** Fills the address from ViaCEP once a complete CEP is typed. */
  const searchCep = async (cep: string) => {
    lookup.current?.abort()
    if (!isValidCep(onlyDigits(cep))) {
      setCepStatus('idle')
      return
    }
    const controller = new AbortController()
    lookup.current = controller
    setCepStatus('loading')
    try {
      const address = await lookupCep(cep, controller.signal)
      if (controller.signal.aborted) return
      if (!address) {
        setCepStatus('not-found')
        return
      }
      const options = { shouldDirty: true, shouldValidate: true }
      if ((STATES as readonly string[]).includes(address.state)) {
        form.setValue('state', address.state as PropertyFormValues['state'], options)
      }
      // CEPs of a whole city have no street or neighborhood: keep what is already there.
      for (const field of ['city', 'neighborhood', 'street'] as const) {
        if (address[field]) form.setValue(field, address[field], options)
      }
      setCepStatus('found')
      form.setFocus('number')
    } catch {
      if (!controller.signal.aborted) setCepStatus('error')
    }
  }

  // The CEP last looked up: typing past its end leaves the same CEP, which must not be
  // looked up (and overwrite the address) again.
  const [lastCep, setLastCep] = useState(defaultValues.zipCode)
  const zipCode = form.register('zipCode')

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(toPropertyInput(values))
    } catch (error) {
      applyApiError(error, form.setError, API_FIELD_MESSAGES)
    }
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      <FormError message={errors.root?.message} />
      <TextField
        label="Nome"
        placeholder="Casa da praia"
        autoFocus
        error={errors.name?.message}
        {...form.register('name')}
      />

      <div className="grid gap-2">
        <Label id={typeLabelId}>Tipo</Label>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <RadioGroup
              aria-labelledby={typeLabelId}
              value={field.value}
              onValueChange={field.onChange}
              className="flex gap-6"
            >
              {(['HOUSE', 'APARTMENT'] as const).map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value={value} />
                  {PROPERTY_TYPE_LABELS[value]}
                </label>
              ))}
            </RadioGroup>
          )}
        />
      </div>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-medium">Endereço</legend>
        <div className="grid items-start gap-4 sm:grid-cols-[10rem_1fr]">
          <TextField
            label="CEP"
            inputMode="numeric"
            placeholder="00000-000"
            error={errors.zipCode?.message}
            hint={CEP_HINTS[cepStatus]}
            trailing={
              cepStatus === 'loading' ? (
                <Loader2 className="text-muted-foreground mr-2 size-4 animate-spin" aria-hidden />
              ) : undefined
            }
            {...zipCode}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const cep = applyMask(event.target, maskCep)
              void zipCode.onChange(event)
              if (cep === lastCep) return
              setLastCep(cep)
              void searchCep(cep)
            }}
          />
          <TextField label="Rua" error={errors.street?.message} {...form.register('street')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <TextField label="Número" error={errors.number?.message} {...form.register('number')} />
          <TextField
            label="Complemento"
            error={errors.complement?.message}
            {...form.register('complement')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          <TextField
            label="Bairro"
            error={errors.neighborhood?.message}
            {...form.register('neighborhood')}
          />
          <TextField label="Cidade" error={errors.city?.message} {...form.register('city')} />
          <SelectField
            label="UF"
            emptyLabel="—"
            options={STATE_OPTIONS}
            error={errors.state?.message}
            {...form.register('state')}
          />
        </div>
      </fieldset>

      {type === 'APARTMENT' && (
        <fieldset className="grid gap-4">
          <legend className="mb-1 text-sm font-medium">Apartamento</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_6rem_6rem]">
            <TextField
              label="Edifício"
              error={errors.building?.message}
              {...form.register('building')}
            />
            <TextField label="Bloco" error={errors.block?.message} {...form.register('block')} />
            <TextField label="Unidade" error={errors.unit?.message} {...form.register('unit')} />
          </div>
        </fieldset>
      )}

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
