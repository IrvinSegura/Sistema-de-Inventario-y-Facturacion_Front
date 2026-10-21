import { CircleCheck, ScanBarcode, TriangleAlert, X } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { markScannerSeen, ScanCollector, scannerSeen } from '@/lib/barcode-scanner'
import { NOT_DIGIT } from '@/lib/text-rules'

import { findProductByBarcode, type Product } from './queries'

// Same rule as the barcode field in ProductDialogs.
const BARCODE = /^\d{8,14}$/
/** How long "Scan" waits for a reading before warning that none arrived. */
const WAIT_SECONDS = 15

/**
 * Find a product by barcode: "Scan" waits for a reading from a barcode scanner (keyboard mode),
 * and the field takes a code typed by hand. Found: it opens; not found: a new one starts with it.
 */
export function ScanBar({ onFound, onMissing }: { onFound: (product: Product) => void; onMissing: (barcode: string) => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [looking, setLooking] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [noReading, setNoReading] = useState(false)
  const [detected, setDetected] = useState(scannerSeen)
  // A scanner can also type straight into the field: its speed still marks it as detected.
  const fieldReading = useRef(new ScanCollector())
  const waiting = secondsLeft !== null

  const lookUp = async (barcode: string) => {
    if (!BARCODE.test(barcode)) {
      toast.error(t('products.form.invalidBarcode'))
      return
    }
    setLooking(true)
    try {
      const product = await findProductByBarcode(barcode)
      if (product) {
        onFound(product)
      } else {
        onMissing(barcode)
      }
      setCode('')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLooking(false)
    }
  }

  const sawScanner = () => {
    markScannerSeen()
    setDetected(true)
  }

  // A finished reading from "Scan": always sees the latest props.
  const onReading = useEffectEvent((result: { code: string; fast: boolean }) => {
    setSecondsLeft(null)
    if (result.fast) {
      sawScanner()
    }
    void lookUp(result.code)
  })

  // While waiting, every key goes to the reading (not to whatever has focus); Escape cancels.
  useEffect(() => {
    if (!waiting) {
      return
    }
    const reading = new ScanCollector()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSecondsLeft(null)
        return
      }
      event.preventDefault()
      const result = reading.push(event.key, event.timeStamp)
      if (result) {
        onReading(result)
      }
    }
    let left = WAIT_SECONDS
    const tick = window.setInterval(() => {
      left -= 1
      if (left > 0) {
        setSecondsLeft(left)
      } else {
        setSecondsLeft(null)
        setNoReading(true)
      }
    }, 1000)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [waiting])

  const startWaiting = () => {
    setNoReading(false)
    setSecondsLeft(WAIT_SECONDS)
  }

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (fieldReading.current.push(event.key, event.timeStamp)?.fast) {
      sawScanner()
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!looking && code !== '') {
      void lookUp(code)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/30 p-3">
        {waiting ? (
          <div role="status" className="flex min-w-60 flex-1 items-center gap-3">
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <ScanBarcode className="relative size-5" />
            </span>
            <span className="grid">
              <span className="text-sm font-medium">{t('products.scan.waiting')}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('products.scan.waitingHint', { count: secondsLeft })}
              </span>
            </span>
            <Button type="button" variant="outline" className="ml-auto" onClick={() => setSecondsLeft(null)}>
              {t('products.form.cancel')}
            </Button>
          </div>
        ) : (
          <>
            <Button type="button" className="h-10" onClick={startWaiting} disabled={looking}>
              <ScanBarcode />
              {t('products.scan.button')}
            </Button>
            <form onSubmit={onSubmit} className="flex min-w-60 flex-1 gap-2">
              <Input value={code} inputMode="numeric" autoComplete="off" maxLength={14}
                onChange={(event) => setCode(event.target.value.replace(NOT_DIGIT, ''))} onKeyDown={onFieldKey}
                placeholder={t('products.scan.placeholder')} aria-label={t('products.scan.label')} className="h-10 text-base" />
              <Button type="submit" variant="outline" className="h-10" disabled={looking || code === ''}>
                {looking ? t('products.scan.looking') : t('products.scan.submit')}
              </Button>
            </form>
          </>
        )}
        {detected && !waiting && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="size-3.5" />
            {t('products.scan.detected')}
          </span>
        )}
      </div>

      {noReading && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="grid flex-1 gap-0.5">
            <span className="font-medium">{t('products.scan.noReadingTitle')}</span>
            <span className="text-muted-foreground">{t('products.scan.noReading')}</span>
          </span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t('app.close')} onClick={() => setNoReading(false)}>
            <X />
          </Button>
        </div>
      )}
    </div>
  )
}
