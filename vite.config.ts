import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Fails the build, not the deployed page, when VITE_STORE_TIME_ZONE is misspelled or a fixed
 * offset. src/lib/days.ts checks it again as the app loads; it can't be imported here because it
 * reads import.meta.env, which config files don't have.
 */
function checkStoreTimeZone(mode: string) {
  const timeZone = loadEnv(mode, process.cwd(), 'VITE_').VITE_STORE_TIME_ZONE?.trim()
  if (!timeZone) {
    return
  }
  let resolved: string
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone
  } catch {
    throw new Error(`VITE_STORE_TIME_ZONE is not a valid IANA time zone: "${timeZone}"`)
  }
  if (/^[+-]/.test(resolved)) {
    throw new Error(`VITE_STORE_TIME_ZONE must be an IANA time zone, not a fixed offset: "${timeZone}"`)
  }
}

export default defineConfig(({ mode }) => {
  checkStoreTimeZone(mode)
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
