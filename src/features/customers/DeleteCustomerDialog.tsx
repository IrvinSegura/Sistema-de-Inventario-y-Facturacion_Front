import { Archive, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, errorMessage } from '@/api/errors'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { showSuccess } from '@/lib/success-popup'

import { type Customer, useDeleteCustomer, useUpdateCustomer } from './queries'

// Same message as the API's CustomerService.IN_USE_MESSAGE.
const IN_USE = 'Customer has sales; deactivate it instead'

// Deleting only works for customers without sales; for the rest the API says so and the dialog
// offers to deactivate it instead, which keeps its sales history.
export function DeleteCustomerDialog({ customer, onOpenChange }: { customer: Customer | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const deleteCustomer = useDeleteCustomer()
  const updateCustomer = useUpdateCustomer()
  // Keeps the last customer on screen while the dialog animates out; each opening starts clean.
  const [shown, setShown] = useState(customer)
  if (customer && customer !== shown) {
    setShown(customer)
    deleteCustomer.reset()
    updateCustomer.reset()
  }
  const inUse = deleteCustomer.error instanceof ApiError && deleteCustomer.error.message === IN_USE
  const pending = deleteCustomer.isPending || updateCustomer.isPending
  const close = () => onOpenChange(false)

  const onDelete = () => deleteCustomer.mutate(shown!.id!, {
    onSuccess: () => {
      showSuccess(t('customers.delete.doneTitle'), shown!.name)
      close()
    },
  })

  // The same data with active = false; the version guards against someone else's edit in between.
  const onDeactivate = () => {
    const customer = shown!
    updateCustomer.mutate({
      id: customer.id!,
      name: customer.name!,
      taxId: customer.taxId,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      active: false,
      version: customer.version!,
    }, {
      onSuccess: () => {
        showSuccess(t('customers.delete.deactivatedTitle'), customer.name)
        close()
      },
    })
  }

  return (
    <Dialog open={!!customer} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-5" />
          </span>
          <span className="grid gap-1.5">
            <DialogTitle className="text-lg">{t('customers.delete.title', { name: shown?.name })}</DialogTitle>
            <DialogDescription>{t('customers.delete.description')}</DialogDescription>
          </span>
        </DialogHeader>

        {inUse ? (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {shown?.active ? t('customers.delete.inUse') : t('customers.delete.inUseInactive')}
          </p>
        ) : deleteCustomer.isError && <ErrorAlert message={errorMessage(deleteCustomer.error)} />}
        {updateCustomer.isError && <ErrorAlert message={errorMessage(updateCustomer.error)} />}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>{t('customers.form.cancel')}</DialogClose>
          {inUse ? (
            shown?.active && (
              <Button type="button" onClick={onDeactivate} disabled={pending}>
                <Archive />
                {updateCustomer.isPending ? t('customers.form.saving') : t('customers.delete.deactivate')}
              </Button>
            )
          ) : (
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
              <Trash2 />
              {deleteCustomer.isPending ? t('customers.delete.deleting') : t('customers.delete.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
