import { useTranslation } from 'react-i18next'

/**
 * Shows the real progress of a scan job. `stage` is the backend stage key
 * (uploading, queued, hashing, extracting_frames, ...).
 */
export default function CircularProgressLoader({ progress = 0, stage = 'queued' }) {
  const { t } = useTranslation()
  const label = t(`scan.stage.${stage}`, { defaultValue: t('scan.stage.processing') })
  const pct = Math.min(100, Math.max(0, Math.round(progress)))

  return (
    <div
      className="w-full max-w-2xl flex flex-col items-center justify-center py-12 gap-6"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700/80" />
        <div
          className="absolute inset-0 rounded-full border-4 animate-spin"
          style={{
            borderColor: 'transparent',
            borderTopColor: '#22d3ee',
            borderRightColor: '#a855f7',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-white font-semibold">{pct}%</span>
      </div>
      <p className="text-white font-medium text-lg transition-opacity duration-300">{label}</p>
      <div className="w-full max-w-xs h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-cyan-400 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%`, boxShadow: '0 0 12px rgba(34,211,238,0.5)' }}
        />
      </div>
    </div>
  )
}
