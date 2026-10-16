import { useTranslation } from 'react-i18next'

import { managesStore, useUser } from '@/auth/auth-context'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatMoney } from '@/lib/money'

import { ClosingDetails, CloseDrawerForm, DrawerPeople, PaymentMethodSection, SellerSection } from './DrawerParts'
import { DrawerSales } from './DrawerSales'
import { formatDate, formatTime } from './format'
import { isAssigned, isShared, memberNames } from './members'
import { type CashDrawer, useDrawerClosing } from './queries'

// One drawer from the day's list or the history: its closing (or, for managers, the live figures
// and the closing form while it is open) and its tickets.
export function DrawerDetailDialog({ drawer, onOpenChange }: {
  drawer: CashDrawer | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const user = useUser()
  const manager = managesStore(user.role)

  return (
    <Dialog open={drawer !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {drawer && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('drawer.detailTitle', { name: memberNames(drawer), date: formatDate(drawer.businessDate!, i18n.language) })}
              </DialogTitle>
              <DialogDescription>
                {t('drawer.openedAt', {
                  time: formatTime(drawer.openedAt!, i18n.language),
                  amount: formatMoney(drawer.openingFloat!),
                })}
                {drawer.closing && (
                  <> {t('drawer.closedAtBy', {
                    time: formatTime(drawer.closing.closedAt!, i18n.language),
                    name: drawer.closing.closedBy?.name,
                  })}</>
                )}
              </DialogDescription>
            </DialogHeader>
            {(isShared(drawer) || isAssigned(drawer)) && <DrawerPeople drawer={drawer} />}
            {drawer.closing ? (
              <ClosingDetails drawer={drawer} />
            ) : manager ? (
              <OpenDrawerManagerView drawer={drawer} onClosed={() => onOpenChange(false)} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('drawer.stillOpen')}</p>
            )}
            <Separator />
            <section className="grid gap-3">
              <h3 className="text-sm font-medium">{t('drawer.tickets')}</h3>
              <DrawerSales drawerId={drawer.id!} canCancel={manager} showSeller={isShared(drawer)} />
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Managers see the drawer so far (its members don't, to keep their count blind) and can close it.
function OpenDrawerManagerView({ drawer, onClosed }: { drawer: CashDrawer; onClosed: () => void }) {
  const { t } = useTranslation()
  const closing = useDrawerClosing(drawer.id!)
  return (
    <div className="grid gap-4">
      <PaymentMethodSection closing={closing} title={t('drawer.salesSoFar')} />
      {isShared(drawer) && <SellerSection closing={closing} />}
      <Separator />
      <h3 className="text-sm font-medium">{t('drawer.closeForSeller', { name: drawer.responsible?.name })}</h3>
      <CloseDrawerForm drawer={drawer} autoFocus={false} onClosed={onClosed} />
    </div>
  )
}
