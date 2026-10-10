const SHARE_CACHE = 'verifeye-share'
const SHARE_KEY = '/__shared-file__'

/**
 * Returns the file the service worker stored for a Web Share Target request
 * (and removes it), or null.
 */
export async function takeSharedFile() {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(SHARE_CACHE)
    const res = await cache.match(SHARE_KEY)
    if (!res) return null
    await cache.delete(SHARE_KEY)
    const blob = await res.blob()
    const name = decodeURIComponent(res.headers.get('X-File-Name') || 'shared')
    return new File([blob], name, { type: res.headers.get('Content-Type') || blob.type })
  } catch {
    return null
  }
}
