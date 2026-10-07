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

  const originalHost = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  // Forward only safe headers. Copying the full inbound set (incl. host /
  // content-length / accept-encoding) makes Edge fetch() throw and returns 502,
  // which surfaces in the app as login/POS/VAT/report failures.
  const headers = new Headers()
  const passThrough = [
    'accept',
    'authorization',
    'content-type',
    'idempotency-key',
    'x-request-id',
    'x-correlation-id',
  ]
  for (const name of passThrough) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Avoid compressed upstream bodies that some Node middleware paths mishandle.
  headers.set('accept-encoding', 'identity')
  headers.set('x-hexabill-original-host', originalHost)
  headers.set('x-hexabill-edge-secret', process.env.HEXABILL_EDGE_PROXY_SECRET || '')

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  try {
    const upstream = await fetch(target, init)
    // Buffer the body. Streaming upstream.body through Node middleware can
    // drop JSON on 201 Created (Content-Length/chunk mismatch → empty body),
    // which makes expense create look like a soft failure in the UI.
    const body = await upstream.arrayBuffer()
    const outHeaders = new Headers()
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (
        lower === 'content-encoding' ||
        lower === 'transfer-encoding' ||
        lower === 'connection' ||
        lower === 'content-length'
      ) {
        return
      }
      outHeaders.set(key, value)
    })
    // Keep Location on the tenant host so clients never hit Render directly.
    const location = upstream.headers.get('location')
    if (location) {
      try {
        const loc = new URL(location)
        const backend = new URL(backendOrigin)
        if (loc.origin === backend.origin) {
          outHeaders.set('location', `${url.origin}${loc.pathname}${loc.search}`)
        }
      } catch {
        /* keep upstream Location */
      }
    }
    outHeaders.set('content-length', String(body.byteLength))
    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('hexabill edge proxy failed', target, detail)
    return new Response(JSON.stringify({ error: 'EDGE_PROXY_UPSTREAM_FAILED', detail }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}

export const config = {
  matcher: '/api/:path*',
  // Node middleware: Edge fetch to Render was throwing (502 EDGE_PROXY_UPSTREAM_FAILED).
  runtime: 'nodejs',
}
