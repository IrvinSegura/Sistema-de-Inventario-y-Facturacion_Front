import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// Native <select> styled like <Input>: keyboard and mobile pickers work out of the box.
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select {...props}
      className={cn(
        'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground',
        className,
      )} />
  )
}
