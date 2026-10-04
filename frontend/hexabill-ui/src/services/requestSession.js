/** Browser cache boundary only. Host/JWT authorization remains on the server. */
export function createRequestSession(readIdentity) {
  let lastHost, lastToken, generation = 0
  const current = () => {
    const { host, token } = readIdentity()
    if (host !== lastHost || token !== lastToken || generation === 0) {
      lastHost = host
      lastToken = token
      generation += 1
    }
    // Never place a bearer token in a cache key or diagnostic message.
    return `host:${host}:session:${generation}`
  }
  return {
    current,
    reset() { generation += 1 },
    isCurrent(scope) { return scope === current() },
    key(config, scope = current()) {
      const method = String(config?.method || 'GET').toUpperCase()
      return `${method}_${config?.baseURL || ''}_${config?.url || ''}_${JSON.stringify(config?.params || {})}_${scope}`
    },
  }
}
