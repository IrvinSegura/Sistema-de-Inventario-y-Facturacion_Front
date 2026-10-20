import { Printer } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'

// Prints `document` alone: it is rendered into a .print-area outside the app (and any open
// dialog), which the print styles in index.css leave as the only visible element on paper.
export function PrintButton({ label, document, variant = 'outline', className }: {
  label: string
  document: ReactNode
  variant?: 'outline' | 'ghost' | 'default'
  className?: string
}) {
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!printing) {
      return
    }
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done, { once: true })
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printing])

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setPrinting(true)}>
        <Printer />
        {label}
      </Button>
      {printing && createPortal(<div className="print-area">{document}</div>, globalThis.document.body)}
    </>
  )
}
