import { Capacitor, registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'

/** True inside the Android app; everything here is a no-op on the web. */
export const isNative = Capacitor.isNativePlatform()

const Native = registerPlugin('VerifEyeNative')

function base64ToBytes(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Turns a native file description into a File the web app can upload. */
async function loadNativeFile({ path, name, mimeType }) {
  try {
    const res = await fetch(Capacitor.convertFileSrc(path))
    if (res.ok) {
      const blob = await res.blob()
      return new File([blob], name || 'shared', { type: mimeType || blob.type })
    }
  } catch {
    // fall through to the bridge
  }
  const { data } = await Native.readFile({ path })
  return new File([base64ToBytes(data)], name || 'shared', { type: mimeType || 'application/octet-stream' })
}

/**
 * Returns `{ file, source }` when another app shared a file to VerifEye or
 * the bubble captured the screen, otherwise null.
 */
export async function takePendingNativeFile() {
  if (!isNative) return null
  const info = await Native.getPendingFile()
  if (!info?.path) return null
  const file = await loadNativeFile(info)
  Native.deleteFile({ path: info.path }).catch(() => {})
  return { file, source: info.source === 'screenshot' ? 'screenshot' : 'file' }
}

/**
 * Calls `onFile({ file, source })` whenever a pending file shows up while the
 * app is open (share while running, bubble capture). Returns a cleanup fn.
 */
export function watchPendingNativeFile(onFile) {
  if (!isNative) return () => {}
  let disposed = false
  const deliver = async () => {
    const pending = await takePendingNativeFile().catch(() => null)
    if (pending && !disposed) onFile(pending)
  }
  const handles = [Native.addListener('pendingFile', deliver), App.addListener('resume', deliver)]
  return () => {
    disposed = true
    handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}))
  }
}

export const bubble = {
  async hasOverlayPermission() {
    return (await Native.hasOverlayPermission()).granted
  },
  requestOverlayPermission: () => Native.requestOverlayPermission(),
  async isRunning() {
    return (await Native.isBubbleRunning()).running
  },
  start: () => Native.startBubble(),
  stop: () => Native.stopBubble(),
}
