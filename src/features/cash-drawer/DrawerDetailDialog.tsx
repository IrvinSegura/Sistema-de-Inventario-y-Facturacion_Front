import { useTranslation } from 'react-i18next'

import { managesStore, useUser } from '@/auth/auth-context'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate, formatTime } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'

import { BySellerSection, ClosingDetails, CloseDrawerForm, DrawerMembers, PaymentMethodSection } from './DrawerParts'
import { DrawerSales } from './DrawerSales'
import { isAssigned, isShared, memberNames } from './members'
import { type CashDrawer, useDrawerClosing } from './queries'

/**
 * One drawer from the day's list or the history: its closing (or, for managers, the live figures
 * and the closing form while it is open) and its tickets.
 */
export function DrawerDetailDialog({ drawer, onOpenChange }: {
  drawer: CashDrawer | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const user = useUser()
  const manager = managesStore(user.role)

  return (
    <Dialog open={drawer !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg md:max-w-4xl">
        {drawer && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('drawer.detailTitle', { name: memberNames(drawer), date: formatDate(drawer.businessDate!, i18n.language) })}
              </DialogTitle>
              <DialogDescription>
                {t('drawer.openedAt', {
                  time: formatTime(drawer.openedAt, i18n.language),
                  amount: formatMoney(drawer.openingFloat!),
                })}
                {drawer.closing && (
                  <> {t('drawer.closedAtBy', {
                    time: formatTime(drawer.closing.closedAt, i18n.language),
                    name: drawer.closing.closedBy?.name,
                  })}</>
                )}
              </DialogDescription>
            </DialogHeader>
            {/* Two columns on wide screens: the figures on the left, the closing form and tickets on the right. */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid content-start gap-4">
                {(isShared(drawer) || isAssigned(drawer)) && <DrawerMembers drawer={drawer} />}
                {drawer.closing ? (
                  <ClosingDetails drawer={drawer} />
                ) : manager ? (
                  <SalesSoFar drawer={drawer} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('drawer.stillOpen')}</p>
                )}
              </div>
              <div className="grid content-start gap-6 border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                {!drawer.closing && manager && (
                  <section className="grid gap-3">
                    <h3 className="text-sm font-medium">
                      {t('drawer.closeForResponsible', { name: drawer.responsible?.name })}
                    </h3>
                    <CloseDrawerForm drawer={drawer} autoFocus={false} onClosed={() => onOpenChange(false)} />
                  </section>
                )}
                <section className="grid gap-3">
                  <h3 className="text-sm font-medium">{t('drawer.tickets')}</h3>
                  <DrawerSales drawerId={drawer.id!} canCancel={manager} showSeller={isShared(drawer)} />
                </section>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Managers see the drawer so far; its members don't, to keep their count blind. */
function SalesSoFar({ drawer }: { drawer: CashDrawer }) {
  const { t } = useTranslation()
  const closing = useDrawerClosing(drawer.id!)
  return (
    <>
      <PaymentMethodSection closing={closing} title={t('drawer.salesSoFar')} />
      {isShared(drawer) && <BySellerSection closing={closing} />}
    </>
  )
}
