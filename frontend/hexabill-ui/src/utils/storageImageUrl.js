// UIX-003: tenant storage images need the Authorization header, which <img src> never sends.
// These helpers are pure so they can be tested without React or the API client.
const STORAGE_MARKERS = ['/api/storage/', 'storage/tenants/']

export const isAuthedStorageUrl = (url) =>
  typeof url === 'string' && STORAGE_MARKERS.some((marker) => url.includes(marker))

// Path relative to the API base URL, so api.get() attaches the auth header.
export const storageRequestPath = (url) =>
  url.split('?')[0].replace(/^.*\/api\//, '').replace(/^\//, '')
