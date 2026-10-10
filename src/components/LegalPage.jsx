import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

const LEGAL_SECTIONS = {
  privacy: [
    { heading: 'section_intro', body: 'privacy_intro' },
    { heading: 'section_collect', body: 'privacy_collect' },
    { heading: 'section_use', body: 'privacy_use' },
    { heading: 'section_protection', body: 'privacy_protection' },
    { heading: 'section_rights', body: 'privacy_rights' },
    { heading: 'section_contact', body: 'privacy_contact' },
  ],
  terms: [
    { heading: 'section_accept', body: 'terms_accept' },
    { heading: 'section_service', body: 'terms_service' },
    { heading: 'section_responsibilities', body: 'terms_responsibilities' },
    { heading: 'section_liability', body: 'terms_liability' },
    { heading: 'section_ip', body: 'terms_ip' },
    { heading: 'section_contact', body: 'terms_contact' },
  ],
}

export default function LegalPage({ type, onBack }) {
  const { t } = useTranslation()
  const sections = LEGAL_SECTIONS[type]
  const title = type === 'privacy' ? t('legal.privacy_title') : t('legal.terms_title')
  const updated = t('legal.updated_jan')
  const containerRef = useRef(null)

  useEffect(() => {
    containerRef.current?.scrollTo(0, 0)
  }, [type])

  if (!sections) return null

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="safe-top flex items-center gap-3 px-4 py-4 border-b border-line shrink-0">
        <button
          onClick={onBack}
          className="p-2 text-fg hover:bg-surface-2 rounded-full transition-colors"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-bold text-fg">{title}</h1>
      </header>
      <main ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6 pb-12">
        <div className="max-w-2xl mx-auto">
          <p className="text-muted text-sm mb-8">{t('legal.last_updated', { date: updated })}</p>
          <div className="space-y-8">
            {sections.map((section, i) => (
              <div key={i} className="card p-5">
                <h2 className="text-accent font-semibold mb-3">{t(`legal.${section.heading}`)}</h2>
                <p className="text-fg/90 text-sm leading-relaxed">{t(`legal.${section.body}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
