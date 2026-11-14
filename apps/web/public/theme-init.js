/* global window, document */
// Applies the saved theme before the first paint, so dark mode never flashes white. A file
// rather than an inline script, so the Content-Security-Policy can forbid inline scripts.
try {
  const saved = localStorage.getItem('hostly-theme')
  // Anything but an explicit light or dark (missing, "system", garbage) follows the
  // system, exactly as ThemeProvider reads it.
  const dark =
    saved === 'dark' ||
    (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
} catch {
  // No storage (private mode, blocked): the theme follows the system once React starts.
}
