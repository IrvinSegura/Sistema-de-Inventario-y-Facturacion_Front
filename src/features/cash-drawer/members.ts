import type { CashDrawer } from './queries'

// Who sells from the drawer, by name: one person for a personal drawer, several for a shared one.
export function memberNames(drawer: CashDrawer): string {
  return (drawer.members ?? []).map((member) => member.name).join(', ')
}

export function isShared(drawer: CashDrawer): boolean {
  return (drawer.members?.length ?? 0) > 1
}

// Opened by a manager who handed over the float, rather than by its responsible.
export function isAssigned(drawer: CashDrawer): boolean {
  return drawer.openedBy?.id !== drawer.responsible?.id
}

// Only the responsible counts and closes it (managers too, from "Today's drawers").
export function isResponsible(drawer: CashDrawer, userId: number): boolean {
  return drawer.responsible?.id === userId
}
