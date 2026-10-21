import { Store } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { todayDay } from '@/lib/days'
import { PreferencesMenu } from '@/preferences/PreferencesMenu'

// Read once, in the store's zone: the footer doesn't need to change at midnight on New Year's Eve.
const YEAR = todayDay().slice(0, 4)

// Store illustration (pre-cropped). In public/ so a missing file only leaves the wave's tint
// instead of breaking the build.
const PHOTO_URL = `${import.meta.env.BASE_URL}auth/grocery-store.jpg`
const WAVE_ID = 'auth-photo-wave'

/**
 * Sign-in screens: the form on the left and the store illustration along the right edge (wide
 * screens only). Light or dark from the toggles in the header.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background text-foreground">
      <WavePhoto />
      {/* Full width, so the toggles sit above the illustration instead of crowding the form's column. */}
      <header className="relative flex items-center justify-between gap-4 px-4 py-6 sm:px-8 lg:px-12">
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Store className="size-5" />
          </span>
          {/* Phones only have room for the logo next to the toggles. */}
          <span className="hidden text-base font-semibold tracking-tight whitespace-nowrap sm:inline">{t('app.name')}</span>
        </span>
        <PreferencesMenu />
      </header>
      <div className="relative flex flex-1 flex-col px-4 pb-6 sm:px-8 lg:w-1/2 lg:px-12">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-xs text-muted-foreground">© {YEAR} {t('app.name')}</p>
      </div>
    </div>
  )
}

export function AuthHeading({ icon, title, description }: { icon?: ReactNode; title: string; description: ReactNode }) {
  return (
    <div className="mb-8 grid gap-2 text-center">
      {icon && (
        // The icon's size is set here, so every sign-in screen matches.
        <span className="mb-6 flex size-16 items-center justify-self-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm [&>svg]:size-8">{icon}</span>
      )}
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-base text-muted-foreground">{description}</p>
    </div>
  )
}

/**
 * Along the page's right edge, past the form's column, from below the header to a margin above the
 * bottom; its left edge is a wave. Anchored to the top so the awning stays in view. Without the file,
 * a faint tint shows.
 */
function WavePhoto() {
  return (
    <>
      <svg aria-hidden className="absolute size-0">
        <clipPath id={WAVE_ID} clipPathUnits="objectBoundingBox">
          <path d="M0.16,0 L1,0 L1,1 L0.06,1 C0.02,0.98 0,0.94 0.03,0.9 C0.06,0.86 0.12,0.84 0.13,0.78
            C0.14,0.71 0.08,0.66 0.09,0.58 C0.1,0.5 0.19,0.46 0.2,0.37 C0.21,0.28 0.12,0.22 0.13,0.13
            C0.14,0.07 0.17,0.04 0.16,0 Z" />
        </clipPath>
      </svg>
      <div aria-hidden className="absolute top-24 right-0 bottom-10 hidden w-[46%] bg-current/10 bg-cover bg-top lg:block"
        style={{ clipPath: `url(#${WAVE_ID})`, backgroundImage: `url(${PHOTO_URL})` }} />
    </>
  )
}
