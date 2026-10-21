import type { ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Label, input and either the validation error or a hint below it. */
export function FormField({ id, label, hint, error, className, children }: {
  /** The child input's id, which the label points at. */
  id: string
  label: string
  hint?: string
  error?: FieldError
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid content-start gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error
        ? <p className="text-sm text-destructive">{error.message}</p>
        : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
