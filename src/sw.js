import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

export const SHARE_CACHE = 'verifeye-share'
export const SHARE_KEY = '/__shared-file__'

/**
 * Web Share Target: Android posts the shared file here. Stash it in the Cache
 * API and open the app, which picks it up (see src/lib/sharedFile.js).
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/share') return
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData()
        const file = form.get('file')
        if (file && typeof file === 'object' && file.size > 0) {
          const cache = await caches.open(SHARE_CACHE)
          const headers = new Headers({
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name || 'shared'),
          })
          await cache.put(SHARE_KEY, new Response(file, { headers }))
          return Response.redirect('/?shared=1', 303)
        }
        const text = form.get('url') || form.get('text') || ''
        return Response.redirect(`/?shared_text=${encodeURIComponent(String(text)).slice(0, 2000)}`, 303)
      } catch {
        return Response.redirect('/', 303)
      }
    })()
  )
})

// SPA navigations: serve the cached shell, fall back to network.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//, /^\/share$/] }))

// Translations: network first, cached copy when offline.
registerRoute(({ url }) => url.pathname.startsWith('/locales/'), new NetworkFirst({ cacheName: 'verifeye-locales' }))
