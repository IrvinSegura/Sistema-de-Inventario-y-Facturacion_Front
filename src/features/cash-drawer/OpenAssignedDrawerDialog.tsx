import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage } from '@/api/errors'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { amountField } from '@/lib/amount-field'
import { showSuccess } from '@/lib/success-popup'

import { type AssignableSeller, useOpenAssignedDrawer } from './queries'

// Managers open today's drawer for one seller, or a shared one for several, and hand over the float.
export function OpenAssignedDrawerDialog({ open, onOpenChange, sellers }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sellers: AssignableSeller[]
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('drawer.assign.title')}</DialogTitle>
          <DialogDescription>{t('drawer.assign.description')}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from an empty form. */}
        {open && <AssignForm sellers={sellers} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ sellers, onDone }: { sellers: AssignableSeller[]; onDone: () => void }) {
  const { t } = useTranslation()
  const openDrawer = useOpenAssignedDrawer()
  const schema = useMemo(() => z.object({
    openingFloat: amountField(t, 999_999.99),
    memberIds: z.array(z.number()).min(1, t('drawer.assign.membersRequired')),
    responsibleId: z.string().min(1, t('drawer.assign.responsibleRequired')),
  }), [t])
  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitted } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { openingFloat: 0, memberIds: [] as number[], responsibleId: '' },
  })
  const [memberIds, responsibleId] = useWatch({ control, name: ['memberIds', 'responsibleId'] })
  const members = sellers.filter((seller) => memberIds.includes(seller.id!))

  // One member is also the responsible; a responsible who is unticked stops being one.
  function toggle(id: number, checked: boolean) {
    const next = checked ? [...memberIds, id] : memberIds.filter((memberId) => memberId !== id)
    setValue('memberIds', next, { shouldValidate: isSubmitted })
    if (next.length === 1) {
      setValue('responsibleId', String(next[0]), { shouldValidate: isSubmitted })
    } else if (!next.includes(Number(responsibleId))) {
      setValue('responsibleId', '', { shouldValidate: isSubmitted })
    }
  }

  const onSubmit = handleSubmit(({ openingFloat, memberIds: ids, responsibleId: responsible }) =>
    openDrawer.mutate({ openingFloat, memberIds: ids, responsibleId: Number(responsible) }, {
      onSuccess: () => {
        showSuccess(t(ids.length > 1 ? 'drawer.assign.openedShared' : 'drawer.assign.opened'))
        onDone()
      },
    }))

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {openDrawer.isError && <ErrorAlert message={errorMessage(openDrawer.error)} />}
      <div className="grid gap-2">
        <Label htmlFor="assign-float">{t('drawer.openingFloatInput')}</Label>
        <Input id="assign-float" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
          aria-invalid={!!errors.openingFloat} {...register('openingFloat')} />
        {errors.openingFloat && <p className="text-sm text-destructive">{errors.openingFloat.message}</p>}
      </div>
      <fieldset className="grid gap-2" aria-invalid={!!errors.memberIds}>
        <legend className="mb-2 text-sm font-medium">{t('drawer.members')}</legend>
        <p className="text-xs text-muted-foreground">{t('drawer.assign.membersHint')}</p>
        {sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('drawer.assign.nobodyFree')}</p>
        ) : (
          <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-2">
            {sellers.map((seller) => (
              <li key={seller.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                  <input type="checkbox" className="size-4 accent-primary" checked={memberIds.includes(seller.id!)}
                    onChange={(event) => toggle(seller.id!, event.target.checked)} />
                  <span className="flex-1">{seller.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {errors.memberIds && <p className="text-sm text-destructive">{errors.memberIds.message}</p>}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="assign-responsible">{t('drawer.responsible')}</Label>
        <Select id="assign-responsible" value={responsibleId} disabled={members.length === 0}
          aria-invalid={!!errors.responsibleId}
          placeholder={t('drawer.assign.chooseResponsible')}
          onValueChange={(value) => setValue('responsibleId', value, { shouldValidate: isSubmitted })}
          options={members.map((member) => ({ value: String(member.id), label: member.name }))} />
        {errors.responsibleId
          ? <p className="text-sm text-destructive">{errors.responsibleId.message}</p>
          : <p className="text-xs text-muted-foreground">{t('drawer.assign.responsibleHint')}</p>}
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t('drawer.assign.cancel')}</DialogClose>
        <Button type="submit" disabled={openDrawer.isPending || sellers.length === 0}>
          {openDrawer.isPending ? t('drawer.opening') : t('drawer.open')}
        </Button>
      </DialogFooter>
    </form>
  )
}
