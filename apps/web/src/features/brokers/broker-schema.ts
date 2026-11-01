import { z } from 'zod'

import {
  isValidCnpj,
  isValidCpf,
  isValidLandlinePhone,
  isValidMobilePhone,
  maskCnpj,
  maskCpf,
  maskPhone,
  normalizeDocument,
  normalizePhone,
} from '@/lib/validation/brazil'

import type { Broker, BrokerInput, BrokerType } from './api'

/** The document mask that fits the broker type: CPF for a person, CNPJ for a company. */
export function maskDocument(type: BrokerType, value: string): string {
  return type === 'INDIVIDUAL' ? maskCpf(value) : maskCnpj(value)
}

export const brokerFormSchema = z
  .object({
    type: z.enum(['INDIVIDUAL', 'COMPANY']),
    name: z.string().trim().min(1, 'Informe o nome.').max(255, 'Nome longo demais.'),
    email: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email('E-mail inválido.').max(255, 'E-mail longo demais.')),
    ]),
    document: z.string().trim(),
    mobilePhone: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidMobilePhone(value), 'Celular inválido.'),
    landlinePhone: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidLandlinePhone(value), 'Telefone fixo inválido.'),
  })
  .superRefine(({ type, document }, ctx) => {
    if (document === '') return
    if (type === 'INDIVIDUAL' && !isValidCpf(document)) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'CPF inválido.' })
    }
    if (type === 'COMPANY' && !isValidCnpj(document)) {
      ctx.addIssue({ code: 'custom', path: ['document'], message: 'CNPJ inválido.' })
    }
  })

export type BrokerFormValues = z.input<typeof brokerFormSchema>
type ParsedBroker = z.output<typeof brokerFormSchema>

export const EMPTY_BROKER_FORM: BrokerFormValues = {
  type: 'INDIVIDUAL',
  name: '',
  email: '',
  document: '',
  mobilePhone: '',
  landlinePhone: '',
}

export function toFormValues(broker: Broker): BrokerFormValues {
  return {
    type: broker.type,
    name: broker.name,
    email: broker.email ?? '',
    document: broker.document ? maskDocument(broker.type, broker.document) : '',
    mobilePhone: broker.mobilePhone ? maskPhone(broker.mobilePhone) : '',
    landlinePhone: broker.landlinePhone ? maskPhone(broker.landlinePhone) : '',
  }
}

/** Parsed form values (already trimmed) to what the API takes: blank means no value. */
export function toBrokerInput(values: ParsedBroker): Required<BrokerInput> {
  return {
    type: values.type,
    name: values.name,
    email: values.email || null,
    document: values.document ? normalizeDocument(values.document) : null,
    mobilePhone: values.mobilePhone ? normalizePhone(values.mobilePhone) : null,
    landlinePhone: values.landlinePhone ? normalizePhone(values.landlinePhone) : null,
  }
}
