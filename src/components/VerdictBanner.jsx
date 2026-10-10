import { useTranslation } from 'react-i18next'
import Gauge from './Gauge'

const STYLES = {
  likely_ai: { text: 'text-ai', soft: 'bg-ai-soft', ring: 'ring-ai/40' },
  inconclusive: { text: 'text-unclear', soft: 'bg-unclear-soft', ring: 'ring-unclear/40' },
  likely_real: { text: 'text-real', soft: 'bg-real-soft', ring: 'ring-real/40' },
}

/** Derives the band from the legacy two-way status for results saved before verdict bands existed. */
export function deriveVerdict({ verdict, status, fakeProbability, score }) {
  if (verdict) return verdict
  const p = fakeProbability ?? (status === 'FAKE' ? score : 100 - (score ?? 0))
  if (p >= 70) return 'likely_ai'
  if (p <= 30) return 'likely_real'
  return 'inconclusive'
}

export default function VerdictBanner({ verdict, fakeProbability, confidence, confidenceFactors = [] }) {
  const { t } = useTranslation()
  const style = STYLES[verdict] ?? STYLES.inconclusive

  return (
    <section className="card p-5 flex flex-col items-center text-center" aria-live="polite">
      <Gauge
        value={fakeProbability ?? 0}
        verdict={verdict}
        label={t('verdict.ai_probability_label')}
        sublabel={confidence != null ? t('verdict.confidence', { value: confidence }) : null}
      />
      <p
        className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${style.soft} ${style.text}`}
      >
        {t(`verdict.band_${verdict}`)}
      </p>
      <p className="text-sm text-muted mt-3 max-w-md">{t(`verdict.band_${verdict}_explainer`)}</p>
      {confidenceFactors.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2 mt-3">
          {confidenceFactors.map((f) => (
            <li key={f} className={`text-xs px-2 py-1 rounded-full bg-surface-2 ring-1 ${style.ring} ${style.text}`}>
              {t(`verdict.factor_${f}`)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
