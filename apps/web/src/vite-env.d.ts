/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Hostly API, e.g. `http://localhost:3333`. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
