import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App } from '@capacitor/app'
import { bubble, isNative } from '../native/verifeye'

/** Android-only: controls for the floating bubble (overlay + screen capture). */
export default function BubbleSettings() {
  const { t } = useTranslation()
  const [overlay, setOverlay] = useState(false)
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = async () => {
    try {
      setOverlay(await bubble.hasOverlayPermission())
      setRunning(await bubble.isRunning())
    } catch {
      // not native
    }
  }

  useEffect(() => {
    if (!isNative) return undefined
    refresh()
    const sub = App.addListener('resume', refresh)
    return () => {
      sub.then((h) => h.remove()).catch(() => {})
    }
  }, [])

  if (!isNative) return null

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (running) {
        await bubble.stop()
      } else {
        if (!(await bubble.hasOverlayPermission())) {
          await bubble.requestOverlayPermission()
          return
        }
        await bubble.start()
      }
      await refresh()
    } catch (err) {
      setError(err?.code === 'CAPTURE_DENIED' ? t('bubble.capture_denied') : err?.message || t('bubble.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-fg mb-1">{t('bubble.title')}</h2>
      <p className="text-sm text-muted mb-4">{t('bubble.description')}</p>
      <ol className="text-sm text-muted space-y-1 mb-4 list-decimal list-inside">
        <li className={overlay ? 'text-real' : ''}>{t('bubble.step_overlay')}</li>
        <li>{t('bubble.step_capture')}</li>
        <li>{t('bubble.step_use')}</li>
      </ol>
      {error && (
        <p className="text-sm text-ai mb-3" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className={running ? 'btn-secondary w-full' : 'btn-primary w-full'}
        onClick={toggle}
        disabled={busy}
      >
        {running ? t('bubble.stop') : overlay ? t('bubble.start') : t('bubble.grant_overlay')}
      </button>
      {running && <p className="text-xs text-muted mt-3">{t('bubble.running_hint')}</p>}
    </section>
  )
}
