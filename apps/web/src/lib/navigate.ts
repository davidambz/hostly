/** Leaves the app for another site (e.g. Stripe's checkout). Its own module, so tests can mock it. */
export function leaveTo(url: string): void {
  window.location.assign(url)
}
