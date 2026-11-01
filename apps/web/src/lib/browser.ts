/** Reloads the page; its own module so tests can replace it (jsdom can't reload). */
export function reloadPage() {
  window.location.reload()
}
