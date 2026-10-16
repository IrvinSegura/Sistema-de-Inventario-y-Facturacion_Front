// Store behind the animated success popup (components/SuccessPopup): any code can show one after
// creating or saving something; the newest replaces the one on screen.
export interface SuccessMessage {
  id: number
  title: string
  description?: string
}

let current: SuccessMessage | null = null
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function showSuccess(title: string, description?: string) {
  current = { id: nextId++, title, description }
  emit()
}

export function dismissSuccess(id: number) {
  if (current?.id === id) {
    current = null
    emit()
  }
}

export function subscribeSuccess(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function currentSuccess() {
  return current
}
