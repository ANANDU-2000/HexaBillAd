import { matchProductByCode } from './matchProductByCode'

/**
 * Accumulates rapid keystrokes from a hardware scanner.
 * On idle, if exact barcode/SKU match → callback (no Enter required).
 */
export function createBarcodeEngine({
  getProducts,
  onMatch,
  idleMs = 60,
  minLength = 3,
} = {}) {
  let buffer = ''
  let timer = null

  const reset = () => {
    buffer = ''
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const flush = () => {
    const code = buffer.trim()
    reset()
    if (!code || code.length < minLength) return
    const product = matchProductByCode(getProducts?.() || [], code)
    if (product) {
      onMatch?.(product, code)
    }
  }

  const pushChar = (ch) => {
    if (!ch || ch.length !== 1) return
    buffer += ch
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, idleMs)
  }

  /** Feed from a controlled input value (scanner dumps full string then pause). */
  const fromInputValue = (value) => {
    const code = String(value || '').trim()
    if (!code) return
    buffer = code
    flush()
  }

  return { pushChar, fromInputValue, reset, flush }
}
