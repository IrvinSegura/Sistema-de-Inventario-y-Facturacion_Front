/**
 * Building blocks of the documents <PrintButton> prints (or saves as PDF). They use fixed colors,
 * not theme tokens, so the dark theme never reaches the paper.
 */

import { Store } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUser } from '@/auth/auth-context'
import { dateLocale } from '@/i18n'
import { cn } from '@/lib/utils'

/** A sheet with the store and the document's kind, folio and date on top, and who printed it below. */
export function PrintDocument({ kind, folio, date, notice, children }: {
  kind: string
  folio?: number
  date: string
  /** Shown right under the header, e.g. a cancelled sale. */
  notice?: ReactNode
  children: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const user = useUser()
  // The document mounts right before printing, so this is when it was printed.
  const [printedAt] = useState(() => new Date())
  const printed = printedAt.toLocaleString(dateLocale(i18n.language), { dateStyle: 'long', timeStyle: 'short' })
  return (
    <article className="mx-auto grid max-w-[190mm] gap-6 font-sans text-[10pt] leading-snug text-slate-800">
      <header className="grid gap-4">
        <div className="flex items-start justify-between gap-8">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[#1e3a5f] text-white">
              <Store className="size-6" />
            </span>
            <span className="text-[14pt] font-semibold tracking-tight text-[#1e3a5f]">{t('app.name')}</span>
          </div>
          <div className="grid justify-items-end text-right">
            <span className="text-[7.5pt] font-semibold tracking-[0.16em] text-slate-500 uppercase">{kind}</span>
            {folio !== undefined && (
              <span className="text-[20pt] leading-tight font-semibold text-[#1e3a5f] tabular-nums">
                № {String(folio).padStart(6, '0')}
              </span>
            )}
            <span className="text-[9pt] text-slate-600">{date}</span>
          </div>
        </div>
        <div className="flex h-1 overflow-hidden rounded-full">
          <span className="w-2/3 bg-[#1e3a5f]" />
          <span className="flex-1 bg-[#2f80c2]" />
        </div>
      </header>
      {notice}
      {children}
      <footer className="flex justify-between gap-6 border-t border-slate-200 pt-3 text-[7.5pt] text-slate-500">
        <span>{t('app.name')} · {kind}</span>
        <span>{t('print.printed', { date: printed, name: user.name })}</span>
      </footer>
    </article>
  )
}

/** A red banner, e.g. for a cancelled document. */
export function PrintNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-red-800">
      <p className="text-[9pt] font-bold tracking-[0.14em] uppercase">{title}</p>
      {children && <p className="text-[9pt]">{children}</p>}
    </div>
  )
}

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 break-inside-avoid">
      <h2 className="text-[8pt] font-semibold tracking-[0.14em] text-[#1e3a5f] uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** Label/value boxes: customer, seller, payment method... An empty value shows as a dash. */
export function PrintFields({ fields, columns = 3 }: { fields: [string, ReactNode][]; columns?: 2 | 3 | 4 }) {
  return (
    <dl className={cn('grid gap-2', { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns])}>
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-[7pt] font-semibold tracking-[0.12em] text-slate-500 uppercase">{label}</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export interface PrintColumn<T> {
  header: string
  cell: (row: T) => ReactNode
  /** Right-aligned, with tabular figures. */
  numeric?: boolean
  /** Extra classes for the body cells only, not the header. */
  className?: string
}

/** Lines of the document; the header row repeats on every printed page. */
export function PrintTable<T>({ columns, rows, rowKey }: {
  columns: PrintColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string | number
}) {
  // border-separate because collapsed borders would ignore the header cells' rounded corners.
  return (
    <table className="w-full border-separate border-spacing-0 text-[9pt]">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.header} className={cn(
              'bg-[#1e3a5f] px-3 py-2 text-[7.5pt] font-semibold tracking-[0.1em] text-white uppercase first:rounded-l-md last:rounded-r-md',
              column.numeric ? 'text-right' : 'text-left',
            )}>
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={rowKey(row, index)} className="break-inside-avoid even:bg-slate-50">
            {columns.map((column) => (
              <td key={column.header} className={cn(
                'border-b border-slate-200 px-3 py-2 align-top',
                column.numeric && 'text-right tabular-nums',
                column.className,
              )}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export interface PrintTotal {
  label: string
  value: ReactNode
  /** The grand total, on a dark band. */
  grand?: boolean
  /** Bold, under a rule: a closing figure that isn't a grand total. */
  strong?: boolean
  tone?: 'danger' | 'warning'
}

/** Right-aligned summary under the lines; `aside` goes on its left, e.g. a note. */
export function PrintTotals({ rows, aside }: { rows: PrintTotal[]; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-8 break-inside-avoid">
      <div className="text-[8.5pt] text-slate-500">{aside}</div>
      <dl className="grid w-[46%] min-w-60 gap-0.5">
        {rows.map(({ label, value, grand, strong, tone }) => (
          <div key={label} className={cn(
            'flex justify-between gap-4 px-3',
            grand ? 'mt-1 rounded-md bg-[#1e3a5f] py-2 text-[11pt] font-semibold text-white' : 'py-1',
            strong && 'mt-1 border-t border-slate-300 pt-2 text-[10.5pt] font-semibold',
            tone === 'danger' && 'text-red-700',
            tone === 'warning' && 'text-amber-700',
          )}>
            <dt className={cn(!grand && 'text-slate-600', !grand && tone && 'text-current')}>{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Lines to sign, with the expected signer's name under the line when known. */
export function PrintSignatures({ signers }: { signers: { label: string; name?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-16 px-6 pt-14 break-inside-avoid">
      {signers.map(({ label, name }) => (
        <div key={label} className="border-t border-slate-400 pt-1.5 text-center">
          <p className="text-[8.5pt] font-medium text-slate-700">{name ?? ' '}</p>
          <p className="text-[7.5pt] tracking-[0.12em] text-slate-500 uppercase">{label}</p>
        </div>
      ))}
    </div>
  )
}
