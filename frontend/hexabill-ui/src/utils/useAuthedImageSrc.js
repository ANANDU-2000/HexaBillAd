import { useEffect, useState } from 'react'
import api from '../services/api'
import { isAuthedStorageUrl, storageRequestPath } from './storageImageUrl'

// Returns a src that <img> can use. Storage URLs are fetched with auth and turned into a blob URL.
// Other URLs pass through unchanged. Returns null while a storage image is loading or if it fails.
export function useAuthedImageSrc(src) {
  const needsAuth = isAuthedStorageUrl(src)
  const [blobUrl, setBlobUrl] = useState(null)

  useEffect(() => {
    if (!needsAuth) return undefined
    let cancelled = false
    let objectUrl = null
    api.get(storageRequestPath(src), { responseType: 'blob' })
      .then((res) => {
        if (cancelled || !res?.data || res.data.size === 0) return
        objectUrl = URL.createObjectURL(res.data)
        setBlobUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setBlobUrl(null) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setBlobUrl(null)
    }
  }, [src, needsAuth])

  return needsAuth ? blobUrl : src
}
