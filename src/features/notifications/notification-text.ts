import type { TFunction } from 'i18next'

import { formatDate } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'

import type { Notification, NotificationType } from './queries'

export interface NotificationText {
  title: string
  /** A second line with the reason or the amounts; missing when the title says it all. */
  detail?: string
}

/**
 * What a notification says, in the interface language. The API only sends its type and values (which
 * ones each type fills is in its OpenAPI description), so the wording lives here.
 */
export function describeNotification(notification: Notification, t: TFunction, language: string): NotificationText {
  const actor = notification.actor?.name ?? t('notifications.someone')
  const amount = notification.amount === undefined ? undefined : formatMoney(notification.amount)
  switch (notification.type) {
    case 'SALE_CANCELLED':
      return {
        title: t('notifications.types.SALE_CANCELLED', { actor, number: notification.subjectLabel }),
        detail: joinPresent([notification.reason, amount]),
      }
    case 'PURCHASE_CANCELLED':
      return {
        title: t('notifications.types.PURCHASE_CANCELLED', { actor, supplier: notification.subjectLabel }),
        detail: joinPresent([notification.reason, amount]),
      }
    case 'CASH_DRAWER_ASSIGNED':
      return {
        title: t('notifications.types.CASH_DRAWER_ASSIGNED', { actor, amount: amount ?? '—' }),
        detail: notification.subjectLabel && t('notifications.responsible', { name: notification.subjectLabel }),
      }
    case 'CASH_DRAWER_CLOSED':
      return {
        title: t('notifications.types.CASH_DRAWER_CLOSED', {
          actor, date: formatDate(notification.subjectLabel ?? '', language),
        }),
        // A missing difference isn't a balanced drawer: no line rather than $0.00.
        detail: amount && t('notifications.difference', { amount }),
      }
    case 'EMAIL_CHANGED':
    case 'PHONE_CHANGED':
    case 'PASSWORD_RESET':
      return { title: t(`notifications.types.${notification.type}`, { actor }), detail: t('notifications.unexpected') }
    default:
      // A type added to the API before this client knows it.
      return { title: t('notifications.unknown') }
  }
}

/** The screen showing what a notification is about; none for account changes or unknown types. */
export function notificationLink(type: NotificationType | undefined): string | undefined {
  switch (type) {
    case 'SALE_CANCELLED':
    case 'CASH_DRAWER_CLOSED':
      // Sellers find their sales in their drawers; the Sales page is for managers.
      return '/cash-drawer/history'
    case 'PURCHASE_CANCELLED':
      return '/purchases'
    case 'CASH_DRAWER_ASSIGNED':
      return '/cash-drawer'
    default:
      return undefined
  }
}

// "Wrong product · $58.50", or just the parts the API sent.
function joinPresent(parts: (string | undefined)[]): string | undefined {
  return parts.filter(Boolean).join(' · ') || undefined
}
