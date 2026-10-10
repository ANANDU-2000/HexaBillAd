/**
 * Stable idempotency key (sent as externalReference) for POS invoice creation.
 * Retrying the identical sale after a lost response reuses the key, so the server returns the
 * already-created invoice instead of posting a duplicate. Any change to the sale gets a new key.
 */
export function createSaleSubmitKeys(generate = () => crypto.randomUUID()) {
  let current = null
  return {
    keyFor(sale) {
      const fingerprint = JSON.stringify(sale)
      if (!current || current.fingerprint !== fingerprint) current = { fingerprint, key: `pos-${generate()}` }
      return current.key
    },
    reset() {
      current = null
    },
  }
}
