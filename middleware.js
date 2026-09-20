/**
 * Vercel Edge Middleware — trusted /api proxy to Render backend.
 * Injects X-HexaBill-Original-Host + X-HexaBill-Edge-Secret so ASP.NET can
 * resolve tenant/platform scope without trusting client Origin or X-Forwarded-Host.
 *
 * Env (Vercel project):
 *   HEXABILL_API_ORIGIN          — e.g. https://hexabill.onrender.com
 *   HEXABILL_EDGE_PROXY_SECRET   — must match Hosting__EdgeProxySecret on Render
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
