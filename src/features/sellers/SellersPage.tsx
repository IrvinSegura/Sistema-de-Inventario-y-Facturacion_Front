import { ChevronLeft, ChevronRight, Pencil, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dateLocale } from '@/i18n'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'

import { PAGE_SIZE, type Seller, useSellers } from './queries'
import { CreateSellerDialog, EditSellerDialog } from './SellerDialogs'

export function SellersPage() {
  const { t } = useTranslation()
  const currentUser = useUser()
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Seller | null>(null)
  const sellers = useSellers(page)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('sellers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('sellers.description')}</p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <UserPlus />
          {t('sellers.new')}
        </Button>
      </div>

      {sellers.isPending ? (
        <FullPageSpinner />
      ) : sellers.isError ? (
        <ErrorAlert message={errorMessage(sellers.error)} />
      ) : (
        <Card className="gap-0 py-0">
          <SellersTable sellers={sellers.data.content ?? []} currentUserId={currentUser.id}
            onEdit={setEditing} onCreate={() => setCreating(true)} />
          <Pagination page={page} total={sellers.data.page?.totalElements ?? 0}
            loading={sellers.isPlaceholderData} onPageChange={setPage} />
        </Card>
      )}

      <CreateSellerDialog open={creating} onOpenChange={setCreating} />
      <EditSellerDialog seller={editing} currentUserId={currentUser.id}
        onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  )
}

function SellersTable({ sellers, currentUserId, onEdit, onCreate }: {
  sellers: Seller[]
  currentUserId: number
  onEdit: (seller: Seller) => void
  onCreate: () => void
}) {
  const { t, i18n } = useTranslation()

  if (sellers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Users className="size-6 text-muted-foreground" />
        </span>
        <p className="text-sm text-muted-foreground">{t('sellers.empty')}</p>
        <Button variant="outline" onClick={onCreate}>{t('sellers.new')}</Button>
      </div>
    )
  }
  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-4">{t('sellers.columns.name')}</TableHead>
          <TableHead>{t('sellers.columns.role')}</TableHead>
          <TableHead>{t('sellers.columns.status')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('sellers.columns.createdAt')}</TableHead>
          <TableHead className="w-12 pr-4"><span className="sr-only">{t('sellers.columns.actions')}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sellers.map((seller) => (
          <TableRow key={seller.id} className={cn(!seller.active && 'text-muted-foreground')}>
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  {initials(seller.name!)}
                </span>
                <span className="grid min-w-0">
                  <span className="truncate font-medium text-foreground">
                    {seller.name}
                    {seller.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t('sellers.you')}</span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{seller.email}</span>
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={seller.role === 'ADMIN' ? 'default' : 'secondary'}>{t(`app.roles.${seller.role!}`)}</Badge>
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={cn('size-2 rounded-full', seller.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                {seller.active ? t('sellers.active') : t('sellers.inactive')}
              </span>
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">
              {new Date(seller.createdAt!).toLocaleDateString(dateLocale(i18n.language), { dateStyle: 'medium' })}
            </TableCell>
            <TableCell className="pr-4 text-right">
              <Button variant="ghost" size="icon" aria-label={t('sellers.edit', { name: seller.name })}
                onClick={() => onEdit(seller)}>
                <Pencil />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Pagination({ page, total, loading, onPageChange }: {
  page: number
  total: number
  loading: boolean
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-muted-foreground">
      <span className="tabular-nums">{t('sellers.range', { from, to, total })}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" aria-label={t('sellers.previousPage')}
          disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon" aria-label={t('sellers.nextPage')}
          disabled={to >= total || loading} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
