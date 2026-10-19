import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

import type { MessageKey } from '@/i18n'
import { cn } from '@/lib/utils'

export interface SectionTab {
  to: string
  label: MessageKey
}

// Underlined links between the pages of one section (cash drawer, purchases, inventory). The base
// line is an inset shadow, so the active underline covers it without overflowing the nav (an
// overflow made Windows show a vertical scrollbar next to the tabs).
export function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end
          className={({ isActive }) => cn(
            'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none',
            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
            isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}>
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  )
}
