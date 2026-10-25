// @vitest-environment jsdom
// jsdom: i18n touches the document.
import i18n from '@/i18n'

import { beforeAll, describe, expect, it } from 'vitest'

import { es } from '@/i18n/locales/es'
import { formatDate } from '@/lib/date-format'
import { formatMoney } from '@/lib/money'

import { describeNotification, notificationLink } from './notification-text'
import type { Notification } from './queries'

const actor = { id: 1, name: 'Admin' }

function textOf(notification: Notification) {
  return describeNotification(notification, i18n.t, 'es')
}

beforeAll(async () => {
  await i18n.changeLanguage('es')
})

describe('describeNotification', () => {
  it('names the cancelled sale, with the reason and total', () => {
    const text = textOf({
      id: 1, type: 'SALE_CANCELLED', subjectId: 9, subjectLabel: '120', amount: 58.5, reason: 'Wrong product', actor,
    })

    // Literal Spanish, so a mistyped key can't pass by resolving the same way in code and test.
    expect(text.title).toBe('Admin canceló tu venta #120')
    expect(text.detail).toBe(`Wrong product · ${formatMoney(58.5)}`)
  })

  it('names the supplier of a cancelled purchase and leaves out a missing reason', () => {
    const text = textOf({ id: 2, type: 'PURCHASE_CANCELLED', subjectId: 3, subjectLabel: 'Lala', amount: 10, actor })

    expect(text.title).toBe('Admin canceló una compra a Lala')
    expect(text.detail).toBe(formatMoney(10))
  })

  it('shows a closed drawer by its business day and difference, and no difference line without one', () => {
    const closed = { id: 3, type: 'CASH_DRAWER_CLOSED', subjectId: 4, subjectLabel: '2026-10-23', actor } as const

    expect(textOf({ ...closed, amount: -1 })).toEqual({
      title: `Admin cerró tu caja del ${formatDate('2026-10-23', 'es')}`,
      detail: `Diferencia: ${formatMoney(-1)}`,
    })
    expect(textOf(closed).detail).toBeUndefined()
  })

  it('names the responsible of an assigned drawer', () => {
    const text = textOf({ id: 4, type: 'CASH_DRAWER_ASSIGNED', subjectId: 4, subjectLabel: 'Ana', amount: 300, actor })

    expect(text.title).toBe(`Admin te asignó una caja con fondo de ${formatMoney(300)}`)
    expect(text.detail).toBe('Responsable: Ana')
  })

  it('warns about unexpected account changes', () => {
    expect(textOf({ id: 5, type: 'PHONE_CHANGED', actor })).toEqual({
      title: 'Admin cambió el celular de tu cuenta',
      detail: es.notifications.unexpected,
    })
  })

  it('copes with a missing actor and a type this client does not know', () => {
    expect(textOf({ id: 6, type: 'EMAIL_CHANGED' }).title).toBe('Alguien cambió el correo de tu cuenta')
    expect(textOf({ id: 7, type: 'LOW_STOCK' as Notification['type'] })).toEqual({ title: es.notifications.unknown })
  })
})

describe('notificationLink', () => {
  it('points to the screen each type is about, and nowhere for account changes', () => {
    expect(notificationLink('SALE_CANCELLED')).toBe('/cash-drawer/history')
    expect(notificationLink('CASH_DRAWER_CLOSED')).toBe('/cash-drawer/history')
    expect(notificationLink('PURCHASE_CANCELLED')).toBe('/purchases')
    expect(notificationLink('CASH_DRAWER_ASSIGNED')).toBe('/cash-drawer')
    expect(notificationLink('PASSWORD_RESET')).toBeUndefined()
  })
})
