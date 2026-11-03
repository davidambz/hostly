import bookingDark from '@/assets/landing/booking-dark.webp'
import bookingLight from '@/assets/landing/booking-light.webp'
import brokersDark from '@/assets/landing/brokers-dark.webp'
import brokersLight from '@/assets/landing/brokers-light.webp'
import calendarDark from '@/assets/landing/calendar-dark.webp'
import calendarLight from '@/assets/landing/calendar-light.webp'
import listDark from '@/assets/landing/list-dark.webp'
import listLight from '@/assets/landing/list-light.webp'
import propertiesDark from '@/assets/landing/properties-dark.webp'
import propertiesLight from '@/assets/landing/properties-light.webp'
import bookingDarkPhone from '@/assets/landing/booking-dark-phone.webp'
import bookingLightPhone from '@/assets/landing/booking-light-phone.webp'
import brokersDarkPhone from '@/assets/landing/brokers-dark-phone.webp'
import brokersLightPhone from '@/assets/landing/brokers-light-phone.webp'
import calendarDarkPhone from '@/assets/landing/calendar-dark-phone.webp'
import calendarLightPhone from '@/assets/landing/calendar-light-phone.webp'
import listDarkPhone from '@/assets/landing/list-dark-phone.webp'
import listLightPhone from '@/assets/landing/list-light-phone.webp'
import propertiesDarkPhone from '@/assets/landing/properties-dark-phone.webp'
import propertiesLightPhone from '@/assets/landing/properties-light-phone.webp'

export type ScreenId = 'calendar' | 'list' | 'booking' | 'properties' | 'brokers'

export function isScreenId(value: string): value is ScreenId {
  return SCREENS.some((screen) => screen.id === value)
}

export interface Screen {
  id: ScreenId
  /** The tab's label. */
  label: string
  title: string
  caption: string
  /** Describes the capture for screen readers. */
  alt: string
  /** The desktop layout, 16:10. */
  image: { light: string; dark: string }
  /** The phone layout, 390 × 720. */
  phone: { light: string; dark: string }
}

/** The app's real screens, captured with a demo account whose data is all made up. */
export const SCREENS: Screen[] = [
  {
    id: 'calendar',
    label: 'Calendário',
    title: 'O mês de todos os imóveis numa tela',
    caption:
      'Cada cor é um imóvel: barras lado a lado são casas diferentes. No mesmo imóvel, uma reserva que cai em noites já ocupadas não entra.',
    alt: 'Calendário de janeiro com as reservas de quatro imóveis, cada um com uma cor, e a legenda das cores acima.',
    image: { light: calendarLight, dark: calendarDark },
    phone: { light: calendarLightPhone, dark: calendarDarkPhone },
  },
  {
    id: 'list',
    label: 'Lista',
    title: 'As próximas reservas e o que falta receber',
    caption:
      'Busque pelo hóspede, filtre por imóvel e veja o total de cada estadia e quanto ainda falta entrar.',
    alt: 'Lista das próximas reservas com hóspede, imóvel, intermediador, datas, total e o que falta receber.',
    image: { light: listLight, dark: listDark },
    phone: { light: listLightPhone, dark: listDarkPhone },
  },
  {
    id: 'booking',
    label: 'Reserva',
    title: 'O resumo da reserva se faz sozinho',
    caption:
      'Diárias, limpeza, desconto e a comissão do intermediador viram o total do hóspede, o que você recebe e o que falta receber, enquanto você digita.',
    alt: 'Formulário de reserva com o resumo: total do hóspede, comissão, quanto você recebe e quanto falta receber.',
    image: { light: bookingLight, dark: bookingDark },
    phone: { light: bookingLightPhone, dark: bookingDarkPhone },
  },
  {
    id: 'properties',
    label: 'Imóveis',
    title: 'Casas e apartamentos, com o endereço pelo CEP',
    caption: 'Digite o CEP e o endereço se completa. Cada imóvel ganha a sua cor no calendário.',
    alt: 'Lista de imóveis com nome, tipo e endereço.',
    image: { light: propertiesLight, dark: propertiesDark },
    phone: { light: propertiesLightPhone, dark: propertiesDarkPhone },
  },
  {
    id: 'brokers',
    label: 'Intermediadores',
    title: 'Corretores e imobiliárias que trazem reservas',
    caption:
      'Pessoa física com CPF ou empresa com CNPJ, inclusive o novo, com letras. A comissão entra em cada reserva.',
    alt: 'Lista de intermediadores com nome, CPF ou CNPJ e contato.',
    image: { light: brokersLight, dark: brokersDark },
    phone: { light: brokersLightPhone, dark: brokersDarkPhone },
  },
]
