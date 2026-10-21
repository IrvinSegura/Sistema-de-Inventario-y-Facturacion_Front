import { Package } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * The product's photo, or a box icon when it has none or the link is broken. A failed load sticks
 * until the component remounts, so key it by URL to retry a changed link.
 */
export function ProductThumbnail({ url, className }: { url?: string; className?: string }) {
  const [broken, setBroken] = useState(false)

  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted', className)}>
      {url && !broken
        ? <img src={url} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(true)} />
        : <Package className="size-1/2 text-muted-foreground" />}
    </span>
  )
}
