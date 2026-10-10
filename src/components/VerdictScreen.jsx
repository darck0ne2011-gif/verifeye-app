import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RealTimeAnalysis from './RealTimeAnalysis'
import VerdictBanner, { deriveVerdict } from './VerdictBanner'
import FrameTimeline from './FrameTimeline'
import MediaPreview from './MediaPreview'
import GeneratorsCard from './GeneratorsCard'
import ProvenanceCard from './ProvenanceCard'

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
)

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
)

function formatDuration(sec) {
  if (sec == null) return null
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Row({ label, value, mono = false }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-fg text-right ${mono ? 'font-mono text-xs' : ''}`}>{String(value)}</dd>
    </div>
  )
}

/**
 * Renders one scan result. `result` is the object returned by the API
 * (see backend/services/scanner.js); older saved results without `verdict`
 * are still supported.
 */
export default function VerdictScreen({ result, error, file = null, canDownloadPdf = false, onUpgradeClick }) {
  const { t, i18n } = useTranslation()
  const [downloading, setDownloading] = useState(false)

  const r = result ?? {}
  const score = r.displayScore ?? r.score ?? 0
  const status = r.status ?? (score >= 50 ? 'FAKE' : 'REAL')
  const verdict = deriveVerdict({ verdict: r.verdict, status, fakeProbability: r.fakeProbability, score })
  const fakeProbability = r.fakeProbability ?? (status === 'FAKE' ? score : 100 - score)
  const metadata = r.metadata ?? null
  const mediaCategory = r.mediaCategory ?? metadata?.mediaCategory ?? 'image'
  const summary = r.expertSummary ?? metadata?.expertSummary ?? null
  const warnings = r.warnings?.length ? r.warnings : (metadata?.warnings ?? [])
  const provenance = r.provenance ?? metadata?.provenance ?? null
  const evidence = r.evidence ?? metadata?.evidence ?? []

  const handleDownloadPdf = async () => {
    if (!canDownloadPdf) {
      onUpgradeClick?.()
      return
    }
    setDownloading(true)
    try {
      const { generateScanPdf } = await import('../utils/generateScanPdf')
      const doc = generateScanPdf({
        score,
        status,
        verdict,
        confidence: r.confidence ?? null,
        fileName: r.fileName || 'Unknown file',
        fileHash: r.fileHash ?? null,
        aiSignatures: r.aiSignatures ?? null,
        modelScores: r.modelScores ?? null,
        scannedModels: r.scannedModels ?? null,
        metadata,
        expertSummary: summary,
        mediaCategory,
        source: r.source ?? 'file',
        scannedAt: r.scannedAt ?? r.date ?? null,
        warnings,
        timeline: r.timeline ?? null,
        provenance,
        evidence,
        t,
        language: i18n.language,
      })
      const safeName = (r.fileName || 'report').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50)
      const pdfName = `VerifEye-Report-${safeName}.pdf`
      const { exportNativeFile } = await import('../native/verifeye')
      const exported = await exportNativeFile({
        name: pdfName,
        mimeType: 'application/pdf',
        arrayBuffer: doc.output('arraybuffer'),
      })
      if (!exported) doc.save(pdfName)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (error && !result) {
    return (
      <div className="w-full max-w-4xl mx-auto animate-fade-in">
        <section className="card p-4 border-ai/40" role="alert">
          <h3 className="text-sm font-medium text-ai mb-1">{t('verdict.scan_failed')}</h3>
          <p className="text-sm text-fg/90">{error}</p>
        </section>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-fade-in">
      {file && <MediaPreview file={file} mediaCategory={mediaCategory} fileName={r.fileName} />}
      <VerdictBanner
        verdict={verdict}
        fakeProbability={fakeProbability}
        confidence={r.confidence ?? null}
        confidenceFactors={r.confidenceFactors ?? []}
      />

      {summary && (
        <section className="card p-4 border-accent/30">
          <h3 className="text-sm font-medium text-accent mb-2">{t('verdict.ai_expert_interpretation')}</h3>
          <p className="text-sm text-fg/90 leading-relaxed">{summary}</p>
        </section>
      )}

      {warnings.length > 0 && (
        <ul className="card p-4 border-unclear/40 text-sm text-unclear space-y-1">
          {warnings.map((w) => (
            <li key={w}>• {t(`verdict.warning_${w}`, { defaultValue: w })}</li>
          ))}
        </ul>
      )}

      <ProvenanceCard provenance={provenance} evidence={evidence} source={r.source ?? 'file'} />

      <RealTimeAnalysis
        fileType={mediaCategory}
        scannedModels={r.scannedModels}
        modelScores={r.modelScores}
        aiSignatures={r.aiSignatures}
        warnings={warnings}
      />

      <GeneratorsCard generators={r.modelScores?.generators} fakeProbability={fakeProbability} />

      {mediaCategory === 'video' && <FrameTimeline timeline={r.timeline} />}

      {metadata && (
        <section className="card p-4">
          <h3 className="text-sm font-medium text-fg mb-3">{t('verdict.metadata_title')}</h3>
          <dl className="grid gap-2 text-sm">
            <Row label={t('verdict.file_type')} value={metadata.fileType || metadata.extension} mono />
            <Row
              label={t('verdict.file_size')}
              value={metadata.sizeFormatted || (metadata.size ? `${metadata.size} B` : null)}
            />
            <Row label={t('verdict.resolution')} value={metadata.resolution} />
            {r.modelScores?.imageType?.photo != null && (
              <Row
                label={t('verdict.image_type')}
                value={
                  r.modelScores.imageType.photo >= 0.5
                    ? t('verdict.image_type_photo', { value: Math.round(r.modelScores.imageType.photo * 100) })
                    : t('verdict.image_type_illustration', {
                        value: Math.round((r.modelScores.imageType.illustration ?? 0) * 100),
                      })
                }
              />
            )}
            <Row label={t('verdict.camera')} value={metadata.camera} />
            <Row label={t('verdict.software')} value={metadata.software} />
            <Row label={t('verdict.duration')} value={formatDuration(metadata.durationSec)} />
            {mediaCategory === 'video' && <Row label={t('verdict.frames_analyzed')} value={metadata.framesAnalyzed} />}
            {mediaCategory === 'video' && metadata.hasAudio != null && (
              <Row label={t('verdict.audio_track')} value={metadata.hasAudio ? t('common.yes') : t('common.no')} />
            )}
            {mediaCategory === 'audio' && (
              <Row label={t('verdict.analyzed_seconds')} value={formatDuration(metadata.analyzedSec)} />
            )}
            <Row label={t('verdict.created_at')} value={metadata.createdAt} />
            {metadata.hasExif === false && <Row label={t('verdict.exif')} value={t('verdict.exif_none')} />}
            <Row label={t('verdict.scanned_at')} value={r.scannedAt ? new Date(r.scannedAt).toLocaleString() : null} />
            {r.source === 'screenshot' && <Row label={t('verdict.source')} value={t('verdict.source_screenshot')} />}
          </dl>
        </section>
      )}

      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className={`flex-1 min-w-[140px] ${canDownloadPdf ? 'btn-secondary' : 'btn-secondary text-unclear'}`}
          aria-label={canDownloadPdf ? t('history.download_report') : t('history.upgrade_for_pdf')}
          title={canDownloadPdf ? t('history.download_report') : t('history.upgrade_pdf_tooltip')}
        >
          {downloading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : canDownloadPdf ? (
            <DownloadIcon />
          ) : (
            <LockIcon />
          )}
          {t('history.download_report')}
        </button>
      </div>

      {error && <p className="text-unclear text-sm">{error}</p>}
    </div>
  )
}
