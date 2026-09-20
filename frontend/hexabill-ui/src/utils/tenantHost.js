const RESERVED_SLUGS = new Set([
  'www', 'admin', 'api', 'app', 'mail', 'support', 'status', 'static',
  'cdn', 'docs', 'help', 'billing', 'login', 'demo', 'test', 'hexabill',
])

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/

export function isValidTenantSlug(slug) {
  return typeof slug === 'string'
    && slug === slug.toLowerCase()
    && SLUG_PATTERN.test(slug)
    && !slug.includes('--')
    && !RESERVED_SLUGS.has(slug)
}

export function getTenantHost() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const baseDomain = (import.meta.env.VITE_BASE_DOMAIN || 'hexabill.company').toLowerCase().replace(/\.$/, '')
  const platformHost = `admin.${baseDomain}`

  if (!hostname) return { mode: 'unknown', slug: null }
  if (hostname === platformHost) return { mode: 'platform', slug: null }
  if (hostname === baseDomain || hostname === `www.${baseDomain}` || hostname === 'localhost' || hostname === '127.0.0.1') {
    return { mode: 'marketing', slug: null }
  }

  const domainSuffix = `.${baseDomain}`
  if (hostname.endsWith(domainSuffix)) {
    const slug = hostname.slice(0, -domainSuffix.length)
    return isValidTenantSlug(slug) ? { mode: 'tenant', slug } : { mode: 'unknown', slug: null }
  }

  if (hostname.endsWith('.localhost')) {
    const slug = hostname.slice(0, -'.localhost'.length)
    return isValidTenantSlug(slug) ? { mode: 'tenant', slug } : { mode: 'unknown', slug: null }
  }

  return { mode: 'unknown', slug: null }
}

export default getTenantHost
