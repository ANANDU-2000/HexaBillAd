/**
 * Vercel Edge Middleware — trusted /api proxy (when project root is frontend/hexabill-ui).
 * See repo-root middleware.js for the canonical copy.
 */
export default async function middleware(request) {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api')) {
    return
  }

  const backendOrigin = (process.env.HEXABILL_API_ORIGIN || 'https://hexabill.onrender.com').replace(/\/$/, '')
  const target = `${backendOrigin}${url.pathname}${url.search}`

  const headers = new Headers(request.headers)
  const originalHost = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  headers.set('x-hexabill-original-host', originalHost)
  headers.set('x-hexabill-edge-secret', process.env.HEXABILL_EDGE_PROXY_SECRET || '')
  headers.delete('host')

  const init = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  return fetch(target, init)
}

export const config = {
  matcher: '/api/:path*',
}
