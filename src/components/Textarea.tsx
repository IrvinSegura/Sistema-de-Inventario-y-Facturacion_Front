import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Multi-line text with the same look as <Input>.
export function Textarea({ className, rows = 2, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea rows={rows} {...props}
      className={cn(
        'w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30',
        className,
      )} />
  )
}
