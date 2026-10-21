import { Pencil, Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { managesStore, useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { TableSkeleton } from '@/components/TableSkeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTaxRate } from '@/features/products/tax-rate'
import { cn } from '@/lib/utils'

import type { LabeledCategory } from './category-labels'
import { CategoryDialog } from './CategoryDialog'
import { useCategories } from './queries'
import { useLabeledCategories } from './use-labeled-categories'

/** Everyone can see the categories; only admins and supervisors add or edit them (same rule as the API). */
export function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const { role } = useUser()
  const canEdit = managesStore(role)
  const categories = useCategories()
  const labeled = useLabeledCategories(categories.data)
  // null: closed; 'new': creating; a category: editing it.
  const [open, setOpen] = useState<LabeledCategory | 'new' | null>(null)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('categories.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('categories.description')}</p>
        </div>
        {canEdit && (
          <Button size="lg" onClick={() => setOpen('new')}>
            <Plus />
            {t('categories.new')}
          </Button>
        )}
      </div>

      {categories.isPending ? (
        <TableSkeleton />
      ) : categories.isError ? (
        <ErrorAlert message={errorMessage(categories.error)} />
      ) : categories.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Tags className="size-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">{t('categories.empty')}</p>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <Table stickyHeader>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">{t('categories.columns.name')}</TableHead>
                <TableHead className="text-right">{t('categories.columns.defaultTaxRate')}</TableHead>
                <TableHead className={cn(!canEdit && 'pr-4')}>{t('categories.columns.status')}</TableHead>
                {canEdit && (
                  <TableHead className="w-12 pr-4"><span className="sr-only">{t('categories.columns.actions')}</span></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {labeled.map((category) => (
                <TableRow key={category.id} className={cn(!category.active && 'text-muted-foreground')}>
                  <TableCell className="pl-4">
                    <span className="grid min-w-0">
                      <span className="truncate font-medium text-foreground">{category.label}</span>
                      {category.descriptionLabel && (
                        <span className="truncate text-xs text-muted-foreground">{category.descriptionLabel}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTaxRate(category.defaultTaxRate!, i18n.language)}
                  </TableCell>
                  <TableCell className={cn(!canEdit && 'pr-4')}>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={cn('size-2 rounded-full', category.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {category.active ? t('categories.active') : t('categories.inactive')}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="pr-4 text-right">
                      <Button variant="ghost" size="icon" aria-label={t('categories.edit', { name: category.label })}
                        title={t('categories.editTitle')} onClick={() => setOpen(category)}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {canEdit && <CategoryDialog open={open} onOpenChange={(isOpen) => !isOpen && setOpen(null)} />}
    </div>
  )
}
