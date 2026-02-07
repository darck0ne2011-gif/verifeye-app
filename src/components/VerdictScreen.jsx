import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RealTimeAnalysis from './RealTimeAnalysis'
import DeepfakeAlert from './DeepfakeAlert'
import VerifiedBadge from './VerifiedBadge'
import { generateScanPdf } from '../utils/generateScanPdf'

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

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

export default function VerdictScreen({
  score = 0,
  status,
  modelScores,
  metadata,
  aiSignatures,
  mediaCategory,
  scannedModels,
  fileHash,
  fileName,
  expertSummary = null,
  error,
  canDownloadPdf = false,
  onUpgradeClick,
  onBack,
}) {
  const { t, i18n } = useTranslation()
  const [downloading, setDownloading] = useState(false)
  const isDeepfake = status === 'FAKE' || (status == null && score >= 50)
  const reasonFromSignatures = buildReasonFromAiSignatures(aiSignatures, t)
  const fileType = mediaCategory ?? metadata?.mediaCategory

  const summary = expertSummary ?? metadata?.expertSummary

  // For videos: use expertSummary as reason (scan-specific). For images: use aiSignatures.
  const deepfakeReason = reasonFromSignatures ?? (fileType === 'video' && summary ? summary : null)

  const handleDownloadPdf = () => {
    if (!canDownloadPdf && onUpgradeClick) {
      onUpgradeClick()
      return
    }
    if (!canDownloadPdf) return
    setDownloading(true)
    try {
      const doc = generateScanPdf({
        score,
        status: status ?? (score >= 50 ? 'FAKE' : 'REAL'),
        fileName: fileName || metadata?.fileName || 'Unknown file',
        fileHash: fileHash ?? null,
        aiSignatures,
        modelScores,
        scannedModels,
        metadata,
        expertSummary: summary,
        mediaCategory: fileType,
        t,
        language: i18n.language,
      })
      const safeName = (fileName || 'report').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50)
      doc.save(`VerifEye-Report-${safeName}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-fade-in">
      {summary && (
        <section className="w-full rounded-xl bg-slate-800/60 border border-cyan-500/30 p-4">
          <h3 className="text-sm font-medium text-cyan-400 mb-2">{t('verdict.ai_expert_interpretation')}</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
        </section>
      )}
      {metadata?.credibility && (
        <>
          <section className="w-full rounded-xl bg-slate-800/60 border border-amber-500/40 p-4">
            <h3 className="text-sm font-medium text-amber-400 mb-3">{t('verdict.credibility_meter')}</h3>
            {metadata.credibility.error ? (
              <p className="text-sm text-amber-400/90">
                {t(metadata.credibility.reasoning === 'credibility_error_rate_limit' ? 'verdict.credibility_error_rate_limit' : 'verdict.credibility_error_unavailable')}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metadata.credibility.score >= 70 ? 'bg-emerald-500' : metadata.credibility.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${metadata.credibility.score}%` }}
                    />
                  </div>
                  <span className="text-white font-bold tabular-nums shrink-0">{metadata.credibility.score}%</span>
                </div>
                {metadata.credibility.credibilityRating && (
                  <p className="text-sm font-medium text-slate-300 mb-2">
                    {t('verdict.fact_check_rating')}:{' '}
                    <span
                      className={
                        metadata.credibility.credibilityRating === 'High'
                          ? 'text-emerald-400'
                          : metadata.credibility.credibilityRating === 'Medium'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {t(`verdict.credibility_${metadata.credibility.credibilityRating.toLowerCase()}`)}
                    </span>
                  </p>
                )}
                {metadata.credibility.reasoning && (
                  <p className="text-sm text-slate-400 leading-relaxed">{metadata.credibility.reasoning}</p>
                )}
              </>
            )}
          </section>
          {metadata.credibility.redFlags?.length > 0 && (
            <section className="w-full rounded-xl bg-slate-800/60 border border-red-500/40 p-4">
              <h3 className="text-sm font-medium text-red-400 mb-3">{t('verdict.fact_check_results')}</h3>
              <ul className="space-y-2">
                {metadata.credibility.redFlags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 shrink-0 mt-0.5" aria-hidden>⚠</span>
                    <span className="text-slate-300">{flag}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <RealTimeAnalysis isComplete fileType={fileType} scannedModels={scannedModels} modelScores={modelScores} aiSignatures={aiSignatures} metadata={metadata} />
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
            {metadata.mediaCategory === 'video' && metadata.framesAnalyzed != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Frames Analyzed</dt>
                <dd className="text-white">{metadata.framesAnalyzed}</dd>
              </div>
            )}
            {metadata.mediaCategory === 'video' && metadata.audioAnalysis?.voiceCloneReasoning && (
              <div className="flex flex-col gap-1">
                <dt className="text-slate-500">Voice Clone Detection</dt>
                <dd className="text-white text-sm">{metadata.audioAnalysis.voiceCloneReasoning}</dd>
              </div>
            )}
            {metadata.mediaCategory === 'video' && metadata.lipSyncIntegrity != null && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Lip-Sync Integrity</dt>
                <dd className="text-white">{Math.round(metadata.lipSyncIntegrity * 100)}%</dd>
              </div>
            )}
            {metadata.mediaCategory === 'video' && metadata.analysisMethod && (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t('verdict.analysis_method')}</dt>
                <dd className="text-white">
                  {metadata.analysisMethod === 'native_video' ? t('verdict.analysis_native_video') : t('verdict.analysis_frame_based')}
                </dd>
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
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className={`flex-1 min-w-[140px] py-3 px-4 flex items-center justify-center gap-2 border rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            canDownloadPdf
              ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700'
              : 'bg-slate-800/80 border-slate-600 text-amber-500/90 hover:bg-slate-700/80'
          }`}
          aria-label={canDownloadPdf ? t('history.download_report') : t('history.upgrade_for_pdf')}
          title={canDownloadPdf ? t('history.download_report') : t('history.upgrade_pdf_tooltip')}
        >
          {downloading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : canDownloadPdf ? (
            <DownloadIcon />
          ) : (
            <LockIcon />
          )}
          {t('history.download_report')}
        </button>
        <button className="flex-1 min-w-[140px] py-3 px-4 bg-slate-800 border border-slate-600 rounded-xl text-white font-medium hover:bg-slate-700 transition-colors">
          {t('verdict.view_source')}
        </button>
      </div>
      {isDeepfake ? (
        <DeepfakeAlert probability={score} reason={deepfakeReason} />
      ) : (
        <VerifiedBadge probability={score} />
      )}
      {error && (
        <p className="text-amber-400 text-sm">
          {error === 'API Configuration Missing' ? t('verdict.api_config_missing') : t('verdict.api_error', { error })}
        </p>
      )}
    </div>
  )
}
