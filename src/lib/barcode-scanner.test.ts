import { describe, expect, it } from 'vitest'

import { ScanCollector } from './barcode-scanner'

function type(collector: ScanCollector, text: string, gapMs: number) {
  let at = 1000
  let result = null
  for (const key of [...text, 'Enter']) {
    result = collector.push(key, at)
    at += gapMs
  }
  return result
}

describe('ScanCollector', () => {
  it('recognizes a scanner by its speed', () => {
    expect(type(new ScanCollector(), '7501055363057', 8)).toEqual({ code: '7501055363057', fast: true })
  })

  it('accepts hand-typed codes but not as a scanner', () => {
    expect(type(new ScanCollector(), '7501055363057', 180)).toEqual({ code: '7501055363057', fast: false })
  })

  it('ignores Enter without digits and short fast bursts', () => {
    expect(new ScanCollector().push('Enter', 0)).toBeNull()
    expect(type(new ScanCollector(), '123', 5)).toEqual({ code: '123', fast: false })
  })
})
