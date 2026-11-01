import { maskPhone } from '@/lib/validation/brazil'

import type { Broker } from './api'
import { maskDocument } from './broker-schema'

/** The broker's CPF or CNPJ, masked, or '' when there is none. */
export function documentLine(broker: Broker): string {
  return broker.document ? maskDocument(broker.type, broker.document) : ''
}

/** The phones, masked, mobile first. */
export function phonesLine(broker: Broker): string {
  return [broker.mobilePhone, broker.landlinePhone]
    .filter((phone): phone is string => Boolean(phone))
    .map(maskPhone)
    .join(' · ')
}
