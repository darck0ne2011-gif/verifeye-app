import { useTranslation } from 'react-i18next'

/** Evidence ids produced by the backend verdict (services/verdict.js). */
const EVIDENCE_TONE = {
  c2pa_ai: 'ai',
  metadata_ai: 'ai',
  c2pa_capture: 'real',
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function Chip({ tone, children }) {
  const cls =
    tone === 'ai'
      ? 'bg-ai-soft text-ai'
      : tone === 'real'
        ? 'bg-real-soft text-real'
        : tone === 'warn'
          ? 'bg-unclear-soft text-unclear'
          : 'bg-surface-2 text-muted'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>
}

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-fg text-right break-words min-w-0">{value}</dd>
    </div>
  )
}

/**
 * What the file says about itself: Content Credentials (C2PA) and generator
 * metadata. Shown for every scan so the absence of credentials is explained
 * too, since screenshots and social networks strip them.
 */
export default function ProvenanceCard({ provenance, evidence = [], source = 'file' }) {
  const { t } = useTranslation()
  if (!provenance) return null
  const c2pa = provenance.c2pa ?? {}
  const hints = provenance.metadata?.hints ?? []
  const generator = provenance.generator

  const statusKey = !c2pa.present
    ? c2pa.supported === false
      ? 'unsupported'
      : 'none'
    : c2pa.validation === 'valid'
      ? 'valid'
      : c2pa.validation === 'tampered'
        ? 'tampered'
        : c2pa.validation === 'untrusted'
          ? 'untrusted'
          : 'invalid'
  const statusTone = { valid: 'real', tampered: 'warn', untrusted: 'warn', invalid: 'warn' }[statusKey] ?? 'muted'

  const sourceTypeLabel = c2pa.sourceType
    ? t(`provenance.source_${c2pa.sourceType}`, { defaultValue: c2pa.sourceType })
    : null

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-medium text-fg">{t('provenance.title')}</h3>
        <Chip tone={statusTone}>{t(`provenance.status_${statusKey}`)}</Chip>
      </div>

      {evidence.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-3">
          {evidence.map((e) => (
            <li key={e}>
              <Chip tone={EVIDENCE_TONE[e] ?? 'muted'}>{t(`provenance.evidence_${e}`, { defaultValue: e })}</Chip>
            </li>
          ))}
        </ul>
      )}

      {generator && (
        <p className="text-sm text-fg mb-3">
          {generator.signed
            ? t('provenance.generator_signed', { name: generator.label })
            : t('provenance.generator_declared', { name: generator.label })}
        </p>
      )}

      {c2pa.present ? (
        <dl className="grid gap-1.5">
          <Row label={t('provenance.claim_generator')} value={c2pa.claimGenerator} />
          <Row label={t('provenance.signer')} value={c2pa.signer?.issuer || c2pa.signer?.commonName} />
          <Row label={t('provenance.signed_at')} value={formatDate(c2pa.signedAt)} />
          <Row label={t('provenance.source_type')} value={sourceTypeLabel} />
          {c2pa.ingredients > 0 && <Row label={t('provenance.ingredients')} value={c2pa.ingredients} />}
          {c2pa.actions?.length > 0 && (
            <div className="text-sm">
              <dt className="text-muted mb-1">{t('provenance.actions')}</dt>
              <dd>
                <ul className="space-y-0.5">
                  {c2pa.actions.map((a, i) => (
                    <li key={i} className="text-fg/90">
                      • {t(`provenance.action_${a.action}`, { defaultValue: a.action })}
                      {a.softwareAgent ? ` · ${a.softwareAgent}` : ''}
                      {a.digitalSourceType && a.digitalSourceType !== c2pa.sourceType
                        ? ` · ${t(`provenance.source_${a.digitalSourceType}`, { defaultValue: a.digitalSourceType })}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-xs text-muted">
          {source === 'screenshot' ? t('provenance.none_screenshot') : t('provenance.none_hint')}
        </p>
      )}

      {statusKey === 'tampered' && <p className="text-xs text-unclear mt-2">{t('provenance.tampered_hint')}</p>}
      {statusKey === 'untrusted' && <p className="text-xs text-unclear mt-2">{t('provenance.untrusted_hint')}</p>}

      {hints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-xs text-muted mb-1">{t('provenance.metadata_hints')}</p>
          <ul className="text-sm space-y-0.5">
            {hints.map((h) => (
              <li key={h.generatorId} className="text-fg/90">
                • {h.generatorLabel} <span className="text-muted">({h.field})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
