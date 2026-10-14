import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

// Local product photos require JWT authorization; an img tag cannot send that
// header. Keep the existing tenant guard and display a scoped fetched blob.
export default function ProductImage ({ productId, src, alt = '', ...props }) {
  const { user } = useAuth()
  const scope = `${user?.tenantId ?? ''}:${user?.id ?? ''}:${user?.role ?? ''}:${productId ?? ''}`
  const [resolved, setResolved] = useState(null)
  useEffect(() => {
    let live = true
    let objectUrl
    setResolved(null)
    if (!src) return undefined
    const legacy = /^(?:\/?uploads\/)?\d+\/products\//.test(src)
    if (!legacy) {
      setResolved({ scope, source: src, url: src })
      return undefined
    }
    if (!productId) return undefined
    api.get(`/products/${productId}/image`, { responseType: 'blob' }).then(response => {
      if (!live || !response.data?.type?.startsWith('image/')) return
      objectUrl = URL.createObjectURL(response.data)
      setResolved({ scope, source: src, url: objectUrl })
    }).catch(() => { if (live) setResolved(null) })
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [productId, src, scope])
  return resolved?.scope === scope && resolved?.source === src ? <img src={resolved.url} alt={alt} {...props} /> : <span role={alt ? 'img' : undefined} aria-label={alt ? `${alt} unavailable` : undefined} className={props.className} />
}
