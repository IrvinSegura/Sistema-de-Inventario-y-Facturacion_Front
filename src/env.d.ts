interface ImportMetaEnv {
  /** Base URL of the API, without a trailing slash. */
  readonly VITE_API_URL: string
  /** The store's time zone (IANA ID), the same as the API's app.store.time-zone; America/Mexico_City by default. */
  readonly VITE_STORE_TIME_ZONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
