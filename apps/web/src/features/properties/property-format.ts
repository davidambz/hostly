import type { Property } from './api'

/** "Av. dos Búzios, 1200 · Jurerê": whatever parts are filled. */
export function streetLine(property: Property): string {
  const street = [property.street, property.number].filter(Boolean).join(', ')
  return [street, property.neighborhood].filter(Boolean).join(' · ')
}

/** "Florianópolis/SC". */
export function placeLine(property: Property): string {
  return [property.city, property.state].filter(Boolean).join('/')
}

/** "Mar Azul · Bloco B · Unidade 1204", for apartments; empty otherwise. */
export function apartmentLine(property: Property): string {
  if (property.type !== 'APARTMENT') return ''
  return [
    property.building,
    property.block && `Bloco ${property.block}`,
    property.unit && `Unidade ${property.unit}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
