/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 measurement ID (`G-XXXXXXXXXX`). Absent ⇒ analytics is disabled entirely. */
  readonly VITE_GA_MEASUREMENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
