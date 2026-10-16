import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { ApiError } from '@/api/errors'
import { AuthProvider } from '@/auth/AuthProvider'
import { Toaster } from '@/components/ui/sonner'
import '@/i18n'
import { dropUnknownTheme, themes, themeStorageKey } from '@/preferences/themes'

import { App } from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Client errors (4xx) won't fix themselves; network and 5xx errors get one more try.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
})

dropUnknownTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The class is already on <html> from index.html. next-themes' own pre-paint script only runs
        with server rendering, so it is marked as data to stop React warning about it. */}
    <ThemeProvider attribute="class" themes={[...themes]} scriptProps={{ type: 'application/json' }}
      defaultTheme="system" enableSystem storageKey={themeStorageKey} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster richColors position="top-center" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
