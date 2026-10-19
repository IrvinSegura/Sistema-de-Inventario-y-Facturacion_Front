import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// Round icon, a line of text and an optional action, for lists without rows.
export function EmptyState({ icon: Icon, text, children }: { icon: LucideIcon; text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </span>
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  )
}
