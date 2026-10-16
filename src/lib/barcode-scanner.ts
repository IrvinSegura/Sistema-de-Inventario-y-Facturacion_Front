// Barcode scanners in keyboard mode (the usual USB/Bluetooth ones) type the digits and press Enter.
// The browser can't list them (they look like any keyboard), but their speed gives them away:
// a whole code arrives in a few dozen milliseconds, faster than anyone types.

// Longest pause between two characters of one reading, and shortest code that counts as one.
export const SCANNER_KEY_GAP_MS = 50
export const SCANNER_MIN_LENGTH = 8

// Collects one reading from keydown events; returns the code once Enter (or Tab, which some
// scanners send instead) arrives, or null while it's still in progress.
export class ScanCollector {
  private chars = ''
  private lastAt = 0
  private slow = false

  // fast is true when every character came within SCANNER_KEY_GAP_MS of the previous one.
  push(key: string, at: number): { code: string; fast: boolean } | null {
    if (key === 'Enter' || key === 'Tab') {
      const reading = { code: this.chars, fast: !this.slow && this.chars.length >= SCANNER_MIN_LENGTH }
      this.reset()
      return reading.code ? reading : null
    }
    if (/^\d$/.test(key)) {
      if (this.chars && at - this.lastAt > SCANNER_KEY_GAP_MS) {
        this.slow = true
      }
      this.chars += key
      this.lastAt = at
    }
    return null
  }

  reset() {
    this.chars = ''
    this.lastAt = 0
    this.slow = false
  }
}

const seenKey = 'inventory.scannerSeen'

// Remembered for the browser session, to show "scanner detected" after the first fast reading.
export function scannerSeen(): boolean {
  try {
    return sessionStorage.getItem(seenKey) === 'true'
  } catch {
    return false
  }
}

export function markScannerSeen() {
  try {
    sessionStorage.setItem(seenKey, 'true')
  } catch {
    // Storage blocked: the badge only lasts until the page reloads.
  }
}
