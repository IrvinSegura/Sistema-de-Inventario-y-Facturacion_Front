import { Pencil, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorMessage } from '@/api/errors'
import { useUser } from '@/auth/auth-context'
import { ErrorAlert } from '@/components/ErrorAlert'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dateLocale } from '@/i18n'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'

import { PAGE_SIZE, type UserAccount, useUserAccounts } from './queries'
import { CreateUserDialog, EditUserDialog } from './UserDialogs'

export function UsersPage() {
  const { t } = useTranslation()
  const currentUser = useUser()
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const accounts = useUserAccounts(page)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('users.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('users.description')}</p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <UserPlus />
          {t('users.new')}
        </Button>
      </div>

      {accounts.isPending ? (
        <FullPageSpinner />
      ) : accounts.isError ? (
        <ErrorAlert message={errorMessage(accounts.error)} />
      ) : (
        <Card className="gap-0 py-0">
          <UsersTable accounts={accounts.data.content ?? []} currentUserId={currentUser.id}
            onEdit={setEditing} onCreate={() => setCreating(true)} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={accounts.data.page?.totalElements ?? 0}
            loading={accounts.isPlaceholderData} onPageChange={setPage} />
        </Card>
      )}

      <CreateUserDialog open={creating} onOpenChange={setCreating} />
      <EditUserDialog account={editing} currentUserId={currentUser.id}
        onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  )
}

function UsersTable({ accounts, currentUserId, onEdit, onCreate }: {
  accounts: UserAccount[]
  currentUserId: number
  onEdit: (account: UserAccount) => void
  onCreate: () => void
}) {
  const { t, i18n } = useTranslation()

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Users className="size-6 text-muted-foreground" />
        </span>
        <p className="text-sm text-muted-foreground">{t('users.empty')}</p>
        <Button variant="outline" onClick={onCreate}>{t('users.new')}</Button>
      </div>
    )
  }
  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead className="pl-4">{t('users.columns.name')}</TableHead>
          <TableHead>{t('users.columns.role')}</TableHead>
          <TableHead>{t('users.columns.status')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('users.columns.createdAt')}</TableHead>
          <TableHead className="w-12 pr-4"><span className="sr-only">{t('users.columns.actions')}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id} className={cn(!account.active && 'text-muted-foreground')}>
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  {initials(account.name!)}
                </span>
                <span className="grid min-w-0">
                  <span className="truncate font-medium text-foreground">
                    {account.name}
                    {account.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t('users.you')}</span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{account.email}</span>
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={account.role === 'ADMIN' ? 'default' : account.role === 'SUPERVISOR' ? 'outline' : 'secondary'}>{t(`app.roles.${account.role!}`)}</Badge>
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={cn('size-2 rounded-full', account.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                {account.active ? t('users.active') : t('users.inactive')}
              </span>
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">
              {new Date(account.createdAt!).toLocaleDateString(dateLocale(i18n.language), { dateStyle: 'medium' })}
            </TableCell>
            <TableCell className="pr-4 text-right">
              <Button variant="ghost" size="icon" aria-label={t('users.edit', { name: account.name })}
                onClick={() => onEdit(account)}>
                <Pencil />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
