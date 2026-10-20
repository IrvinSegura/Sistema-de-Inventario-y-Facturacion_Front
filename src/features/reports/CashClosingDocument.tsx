import { useTranslation } from 'react-i18next'

import { PrintDocument, PrintFields, PrintSection, PrintSignatures, PrintTable, PrintTotals } from '@/components/PrintDocument'
import { formatTime } from '@/features/cash-drawer/format'
import { memberNames } from '@/features/cash-drawer/members'
import type { CashClosing } from '@/features/cash-drawer/queries'
import { formatMoney } from '@/lib/money'

import { closingFigures, PAYMENT_METHODS } from './closing-data'

// A day's closing on paper: sales by payment method and seller, every drawer's count and the
// totals, with lines to sign.
export function CashClosingDocument({ closing, date, seller, status }: {
  closing: CashClosing
  date: string
  seller: string
  status: string
}) {
  const { t, i18n } = useTranslation()
  const figures = closingFigures(closing)
  const methods = PAYMENT_METHODS.map((method) => ({ method, amounts: closing.byPaymentMethod?.[method] }))
  const drawers = closing.drawers ?? []
  const time = (instant?: string) => instant ? formatTime(instant, i18n.language) : '—'

  return (
    <PrintDocument kind={t('reports.closing.printKind')} date={date}>
      <PrintFields fields={[
        [t('reports.closing.date'), date],
        [t('sales.columns.seller'), seller],
        [t('reports.closing.status'), status],
      ]} />

      <PrintSection title={t('print.closing.byMethod')}>
        <PrintTable rows={methods} rowKey={({ method }) => method} columns={[
          { header: t('print.closing.method'), cell: ({ method }) => t(`checkout.paymentMethods.${method}`), className: 'font-medium text-slate-900' },
          { header: t('print.closing.sales'), cell: ({ amounts }) => amounts?.saleCount ?? 0, numeric: true },
          { header: t('print.columns.amount'), cell: ({ amounts }) => formatMoney(amounts?.salesTotal ?? 0), numeric: true },
          {
            header: t('print.closing.cancellations'),
            cell: ({ amounts }) => (amounts?.cancellationCount ?? 0) > 0
              ? <span className="text-red-700">−{formatMoney(amounts?.cancellationsTotal ?? 0)} ({amounts?.cancellationCount})</span>
              : '—',
            numeric: true,
          },
          { header: t('print.closing.net'), cell: ({ amounts }) => formatMoney(amounts?.net ?? 0), numeric: true, className: 'font-semibold' },
        ]} />
        <PrintTotals rows={[{ label: t('drawer.netTotal'), value: formatMoney(figures.net), grand: true }]} />
      </PrintSection>

      {(closing.bySeller?.length ?? 0) > 0 && (
        <PrintSection title={t('reports.closing.bySeller')}>
          <PrintTable rows={closing.bySeller ?? []} rowKey={({ seller: ref }, index) => ref?.id ?? index} columns={[
            { header: t('print.closing.seller'), cell: ({ seller: ref }) => ref?.name, className: 'font-medium text-slate-900' },
            { header: t('print.closing.sales'), cell: ({ total }) => total?.saleCount ?? 0, numeric: true },
            { header: t('reports.closing.cashNet'), cell: ({ cash }) => formatMoney(cash?.net ?? 0), numeric: true },
            { header: t('print.closing.net'), cell: ({ total }) => formatMoney(total?.net ?? 0), numeric: true, className: 'font-semibold' },
          ]} />
        </PrintSection>
      )}

      {drawers.length > 0 && (
        <PrintSection title={t('reports.closing.drawers')}>
          <PrintTable rows={drawers} rowKey={(drawer) => drawer.id ?? 0} columns={[
            { header: t('drawer.members'), cell: (drawer) => memberNames(drawer), className: 'font-medium text-slate-900' },
            { header: t('print.closing.shift'), cell: (drawer) => `${time(drawer.openedAt)} – ${time(drawer.closing?.closedAt)}` },
            { header: t('drawer.openingFloat'), cell: (drawer) => formatMoney(drawer.openingFloat ?? 0), numeric: true },
            { header: t('drawer.expectedCash'), cell: (drawer) => drawer.closing ? formatMoney(drawer.closing.expectedCash ?? 0) : '—', numeric: true },
            { header: t('drawer.countedCash'), cell: (drawer) => drawer.closing ? formatMoney(drawer.closing.countedCash ?? 0) : '—', numeric: true },
            {
              header: t('drawer.difference'),
              numeric: true,
              className: 'font-semibold',
              cell: (drawer) => {
                const difference = drawer.closing?.difference
                if (difference === undefined) {
                  return t('reports.closing.stillOpen')
                }
                return <span className={difference < 0 ? 'text-red-700' : difference > 0 ? 'text-amber-700' : undefined}>{formatMoney(difference)}</span>
              },
            },
          ]} />
        </PrintSection>
      )}

      <PrintSection title={t('print.closing.cash')}>
        <PrintTotals
          aside={t('reports.closing.closedDrawers', { count: figures.closedCount, total: figures.drawerCount })}
          rows={[
            { label: t('reports.closing.metrics.floats'), value: formatMoney(figures.floats) },
            { label: t('reports.closing.cashNet'), value: formatMoney(figures.cashNet) },
            { label: t('reports.closing.metrics.expected'), value: formatMoney(figures.expected), strong: true },
            { label: t('reports.closing.metrics.counted'), value: formatMoney(figures.counted) },
            {
              label: t('reports.closing.metrics.difference'),
              value: formatMoney(figures.difference),
              strong: true,
              tone: figures.difference < 0 ? 'danger' : figures.difference > 0 ? 'warning' : undefined,
            },
          ]} />
      </PrintSection>

      <PrintSignatures signers={[
        { label: t('reports.closing.preparedBy') },
        { label: t('drawer.managerSignature') },
      ]} />
    </PrintDocument>
  )
}
