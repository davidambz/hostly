/** Where signup goes: straight to registering the property the visitor named, if any. */
export function signupPath(propertyName: string) {
  const name = propertyName.trim()
  if (!name) return '/cadastro'
  const next = `/imoveis?${new URLSearchParams({ novo: name }).toString()}`
  return `/cadastro?${new URLSearchParams({ redirect: next }).toString()}`
}
