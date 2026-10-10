import { useTranslation } from 'react-i18next'
import { getMediaCategory } from '../utils/fileType.js'

const XIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

const DashIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
  </svg>
)

const FaceIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
)

const ImageLayersIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
)

const FileInfoIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
)

const QualityStarsIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
)

const WaveIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h2l2-6 3 12 3-9 2 6 2-3h2" />
  </svg>
)

/**
 * One row per model that ran. `key` is the translation prefix under
 * `analysis.<key>` (title / pass / fail).
 */
const ITEMS = {
  image: [
    { modelId: 'deepfake', key: 'image_deepfake', icon: FaceIcon, scoreKey: 'deepfake' },
    { modelId: 'genai', key: 'image_genai', icon: ImageLayersIcon, scoreKey: 'ai_generated' },
    { modelId: 'type', key: 'image_type', icon: FileInfoIcon, scoreKey: null },
    { modelId: 'quality', key: 'image_quality', icon: QualityStarsIcon, scoreKey: 'quality', invert: true },
  ],
  video: [
    { modelId: 'genai', key: 'video_genai', icon: ImageLayersIcon, scoreKey: 'ai_generated' },
    { modelId: 'deepfake', key: 'video_deepfake', icon: FaceIcon, scoreKey: 'deepfake' },
    { modelId: 'ai_speech', key: 'video_speech', icon: WaveIcon, scoreKey: 'ai_speech' },
  ],
  audio: [{ modelId: 'ai_speech', key: 'audio_speech', icon: WaveIcon, scoreKey: 'ai_speech' }],
}

function describe(item, { modelScores, aiSignatures, warnings, t }) {
  if (item.modelId === 'type') {
    const parts = []
    if (aiSignatures?.missingExif) parts.push(t('verdict.ai_missing_exif'))
    if (aiSignatures?.suspiciousResolution) {
      parts.push(t('verdict.ai_suspicious_resolution', { res: aiSignatures.suspiciousResolution }))
    }
    if (aiSignatures?.softwareTags?.length) {
      parts.push(t('verdict.ai_software_detected', { tags: aiSignatures.softwareTags.join(', ') }))
    }
    // Informational only: metadata never decides the verdict.
    return {
      subtitle: parts.length ? parts.join('. ') : t(`analysis.${item.key}.pass`),
      state: parts.length ? 'info' : 'pass',
    }
  }

  const raw = modelScores?.[item.scoreKey]
  if (raw == null) {
    if (item.modelId === 'ai_speech' && warnings?.includes('ai_speech_not_enabled')) {
      return { subtitle: t('analysis.speech_not_enabled'), state: 'skipped' }
    }
    if (item.modelId === 'ai_speech' && warnings?.includes('no_audio_track')) {
      return { subtitle: t('analysis.no_audio_track'), state: 'skipped' }
    }
    return { subtitle: t('analysis.no_result'), state: 'skipped' }
  }
  const pct = Math.round(Number(raw) * 100)
  const isFail = item.invert ? raw < 0.4 : raw > 0.5
  return {
    subtitle: isFail ? `${t(`analysis.${item.key}.fail`)} (${pct}%)` : `${t(`analysis.${item.key}.pass`)} (${pct}%)`,
    state: isFail ? 'fail' : 'pass',
  }
}

export default function RealTimeAnalysis({ fileType, scannedModels, modelScores, aiSignatures, warnings }) {
  const { t } = useTranslation()
  const mediaCategory = getMediaCategory(fileType)
  const scanned = Array.isArray(scannedModels) && scannedModels.length ? scannedModels : null
  const items = (ITEMS[mediaCategory] ?? ITEMS.image).filter((item) => !scanned || scanned.includes(item.modelId))
  if (items.length === 0) return null

  return (
    <section className="w-full max-w-4xl mx-auto">
      <h2 className="text-base font-medium text-white mb-4">{t('analysis.title')}</h2>
      <div className="space-y-4">
        {items.map((item) => {
          const Icon = item.icon
          const { subtitle, state } = describe(item, { modelScores, aiSignatures, warnings, t })
          const StatusIcon = state === 'fail' ? XIcon : state === 'pass' ? CheckIcon : DashIcon
          return (
            <div
              key={item.modelId}
              className={`flex items-start justify-between gap-3 py-3 px-4 rounded-xl border ${
                state === 'fail'
                  ? 'bg-red-950/30 border-red-500/40'
                  : state === 'skipped'
                    ? 'bg-slate-800/40 border-slate-700/40 opacity-80'
                    : 'bg-verifeye-card border-slate-700/50'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Icon />
                <div>
                  <p className="text-white font-medium">{t(`analysis.${item.key}.title`)}</p>
                  <p
                    className={`text-sm mt-0.5 ${
                      state === 'fail' ? 'text-red-400' : state === 'info' ? 'text-amber-300/90' : 'text-slate-400'
                    }`}
                  >
                    {subtitle}
                  </p>
                </div>
              </div>
              <StatusIcon />
            </div>
          )
        })}
      </div>
    </section>
  )
}
