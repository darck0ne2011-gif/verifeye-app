import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportNativeFile } from '../native/verifeye'

/** Verdict ids from backend/services/factcheck.js mapped to the app's three colours. */
export const FACT_TONE = {
  supported: 'real',
  contested: 'unclear',
  refuted: 'ai',
  unverifiable: 'muted',
  no_claims: 'muted',
}

const TONE_CLASS = {
  real: { text: 'text-real', bg: 'bg-real-soft', border: 'border-real/40' },
  unclear: { text: 'text-unclear', bg: 'bg-unclear-soft', border: 'border-unclear/40' },
  ai: { text: 'text-ai', bg: 'bg-ai-soft', border: 'border-ai/40' },
  muted: { text: 'text-muted', bg: 'bg-surface-2', border: 'border-line' },
}

function Chip({ verdict, children }) {
  const tone = TONE_CLASS[FACT_TONE[verdict] ?? 'muted']
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${tone.bg} ${tone.text}`}>
      {children}
    </span>
  )
}

function SourceLink({ source }) {
  const { t } = useTranslation()
  const label = source.publisher || source.site || source.url
  return (
    <li className="text-sm min-w-0">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:text-accent-hover underline underline-offset-2 break-words"
      >
        {source.title || label}
      </a>
      <span className="text-muted text-xs">
        {' '}
        · {label}
        {source.kind === 'factcheck' && (
          <>
            {' '}
            · <span className="text-fg/80">{t('factcheck.source_factcheck')}</span>
            {source.rating ? ` · ${t('factcheck.rating')}: ${source.rating}` : ''}
          </>
        )}
        {(source.reviewDate || source.date) && ` · ${source.reviewDate || source.date}`}
      </span>
    </li>
  )
}

/**
 * Result of a fact-check job (mediaCategory 'post'): overall verdict, the
 * post, each claim with its verdict and the sources it rests on.
 */
export default function FactCheckScreen({ result, error, canDownloadPdf = false, onUpgradeClick }) {
  const { t, i18n } = useTranslation()
  const [downloading, setDownloading] = useState(false)

  if (error && !result) {
    return (
      <section className="card p-4 border-ai/40" role="alert">
        <h3 className="text-sm font-medium text-ai mb-1">{t('factcheck.failed')}</h3>
        <p className="text-sm text-fg/90">{error}</p>
      </section>
    )
  }
  const r = result ?? {}
  const verdict = r.verdict ?? 'unverifiable'
  const tone = TONE_CLASS[FACT_TONE[verdict] ?? 'muted']
  const claims = r.claims ?? []
  const sources = r.sources ?? []
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const warnings = r.warnings ?? []
  const post = r.post ?? {}

  const downloadPdf = async () => {
    if (!canDownloadPdf) {
      onUpgradeClick?.()
      return
    }
    setDownloading(true)
    try {
      const { generateFactCheckPdf } = await import('../utils/generateFactCheckPdf')
      const doc = generateFactCheckPdf({ result: r, t, language: i18n.language })
      const name = `VerifEye-FactCheck-${(r.fileName || 'post').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 40)}.pdf`
      const exported = await exportNativeFile({
        name,
        mimeType: 'application/pdf',
        arrayBuffer: doc.output('arraybuffer'),
      })
      if (!exported) doc.save(name)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-fade-in">
      <section className={`card p-5 border ${tone.border}`}>
        <p className="text-xs uppercase tracking-wide text-muted mb-1">{t('factcheck.overall')}</p>
        <h2 className={`text-2xl font-bold ${tone.text}`}>{t(`factcheck.verdict_${verdict}`)}</h2>
        {r.confidence != null && claims.length > 0 && (
          <p className="text-sm text-muted mt-1">{t('factcheck.confidence', { value: r.confidence })}</p>
        )}
        {r.summary && <p className="text-sm text-fg/90 leading-relaxed mt-3">{r.summary}</p>}
      </section>

      {warnings.length > 0 && (
        <ul className="card p-4 border-unclear/40 text-sm text-unclear space-y-1">
          {warnings.map((w) => (
            <li key={w}>• {t(`factcheck.warning_${w}`, { defaultValue: w })}</li>
          ))}
        </ul>
      )}

      {post.text && (
        <section className="card p-4">
          <h3 className="text-sm font-medium text-fg mb-1">{t('factcheck.post_title')}</h3>
          <p className="text-xs text-muted mb-2">
            {[post.author, post.platform, post.date].filter(Boolean).join(' · ') ||
              (post.fromScreenshot ? t('factcheck.from_screenshot') : t('factcheck.from_text'))}
          </p>
          <blockquote className="text-sm text-fg/90 whitespace-pre-wrap border-l-2 border-line pl-3">
            {post.text}
          </blockquote>
          {post.imageDescription && (
            <p className="text-xs text-muted mt-2">
              {t('factcheck.image_desc')}: {post.imageDescription}
            </p>
          )}
        </section>
      )}

      {claims.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-fg">{t('factcheck.claims_title', { count: claims.length })}</h3>
          {claims.map((c) => {
            const ctone = TONE_CLASS[FACT_TONE[c.verdict] ?? 'muted']
            const refs = (c.sourceIds ?? []).map((id) => sourceById.get(id)).filter(Boolean)
            return (
              <article key={c.id} className={`card p-4 border ${ctone.border}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-fg">{c.text}</p>
                  <Chip verdict={c.verdict}>{t(`factcheck.verdict_${c.verdict}`)}</Chip>
                </div>
                {c.explanation && <p className="text-sm text-fg/85 leading-relaxed">{c.explanation}</p>}
                {c.confidence != null && c.verdict !== 'unverifiable' && (
                  <p className="text-xs text-muted mt-1">{t('factcheck.confidence', { value: c.confidence })}</p>
                )}
                {refs.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {refs.map((s) => (
                      <SourceLink key={s.id} source={s} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted mt-2">{t('factcheck.no_sources')}</p>
                )}
              </article>
            )
          })}
        </section>
      ) : (
        <section className="card p-4">
          <p className="text-sm text-muted">{t('factcheck.no_claims_hint')}</p>
        </section>
      )}

      {r.skippedClaims?.length > 0 && (
        <section className="card p-4">
          <h3 className="text-sm font-medium text-fg mb-1">{t('factcheck.skipped_title')}</h3>
          <ul className="text-sm text-muted space-y-1">
            {r.skippedClaims.map((c, i) => (
              <li key={i}>
                • {c.text}
                {c.reason ? ` (${c.reason})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        {t('factcheck.disclaimer')}
        {r.providers && (
          <>
            {' '}
            {t('factcheck.providers', {
              factcheck: r.providers.factcheckApi ? t('common.yes') : t('common.no'),
              web: r.providers.webSearch || t('common.no'),
            })}
          </>
        )}
      </p>

      <button
        type="button"
        onClick={downloadPdf}
        disabled={downloading}
        className={`btn-secondary ${canDownloadPdf ? '' : 'text-unclear'}`}
        aria-label={canDownloadPdf ? t('history.download_report') : t('history.upgrade_for_pdf')}
      >
        {downloading
          ? t('home.starting')
          : canDownloadPdf
            ? t('history.download_report')
            : t('history.upgrade_for_pdf')}
      </button>
    </div>
  )
}
