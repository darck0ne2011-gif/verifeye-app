import { useTranslation } from 'react-i18next'
import RealTimeAnalysis from './RealTimeAnalysis'
import DeepfakeAlert from './DeepfakeAlert'
import VerifiedBadge from './VerifiedBadge'

function buildReasonFromAiSignatures(aiSignatures, t) {
  if (!aiSignatures) return null
  const parts = []
  if (aiSignatures.missingExif) parts.push(t('verdict.ai_missing_exif'))
  if (aiSignatures.suspiciousResolution) {
    parts.push(t('verdict.ai_suspicious_resolution', { res: aiSignatures.suspiciousResolution }))
  }
  if (aiSignatures.softwareTags?.length) {
    parts.push(t('verdict.ai_software_detected', { tags: aiSignatures.softwareTags.join(', ') }))
  }
  return parts.length ? parts.join('. ') : null
}

export default function VerdictScreen({ score = 0, metadata, aiSignatures, mediaCategory, error, onBack }) {
  const { t } = useTranslation()
  const isDeepfake = score >= 50
  const reasonFromSignatures = buildReasonFromAiSignatures(aiSignatures, t)
  const fileType = mediaCategory ?? metadata?.mediaCategory

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 animate-fade-in">
      <RealTimeAnalysis isComplete fileType={fileType} />
      {metadata && (
        <section className="w-full rounded-xl bg-slate-800/60 border border-slate-600/60 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">{t('verdict.metadata_title')}</h3>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t('verdict.file_type')}</dt>
              <dd className="text-white font-mono text-xs">{metadata.fileType || metadata.extension || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t('verdict.file_size')}</dt>
              <dd className="text-white">{metadata.sizeFormatted || metadata.size ? `${metadata.size} B` : '—'}</dd>
            </div>
            {metadata.createdAt && (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t('verdict.created_at')}</dt>
                <dd className="text-white">{metadata.createdAt}</dd>
              </div>
            )}
          </dl>
          {aiSignatures && (aiSignatures.missingExif || aiSignatures.suspiciousResolution || (aiSignatures.softwareTags?.length > 0)) && (
            <div className="mt-3 pt-3 border-t border-slate-600/60">
              <h4 className="text-xs font-medium text-amber-400/90 mb-2">{t('verdict.ai_signatures')}</h4>
              <ul className="text-xs text-slate-400 space-y-1">
                {aiSignatures.missingExif && <li>• {t('verdict.ai_missing_exif')}</li>}
                {aiSignatures.suspiciousResolution && (
                  <li>• {t('verdict.ai_suspicious_resolution', { res: aiSignatures.suspiciousResolution })}</li>
                )}
                {aiSignatures.softwareTags?.length > 0 && (
                  <li>• {t('verdict.ai_software_detected', { tags: aiSignatures.softwareTags.join(', ') })}</li>
                )}
              </ul>
            </div>
          )}
        </section>
      )}
      <div className="flex gap-3 flex-wrap">
        <button className="flex-1 min-w-[140px] py-3 px-4 bg-slate-800 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-700 transition-colors">
          {t('verdict.view_source')}
        </button>
      </div>
      {isDeepfake ? (
        <DeepfakeAlert probability={score} reason={reasonFromSignatures} />
      ) : (
        <VerifiedBadge probability={score} />
      )}
      {error && (
        <p className="text-amber-400 text-sm">
          {t('verdict.api_error', { error })}
        </p>
      )}
    </div>
  )
}
