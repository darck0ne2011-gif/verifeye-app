import { useTranslation } from 'react-i18next'

const STYLES = {
  likely_ai: { box: 'bg-red-600', text: 'text-red-400', ring: 'ring-red-500/40' },
  inconclusive: { box: 'bg-amber-500', text: 'text-amber-300', ring: 'ring-amber-400/40' },
  likely_real: { box: 'bg-green-600', text: 'text-green-400', ring: 'ring-green-500/40' },
}

const WarningIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
)
const CheckIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)
const QuestionIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

/** Derives the band from the legacy two-way status for results saved before verdict bands existed. */
export function deriveVerdict({ verdict, status, fakeProbability, score }) {
  if (verdict) return verdict
  const p = fakeProbability ?? (status === 'FAKE' ? score : 100 - (score ?? 0))
  if (p >= 70) return 'likely_ai'
  if (p <= 30) return 'likely_real'
  return 'inconclusive'
}

export default function VerdictBanner({ verdict, fakeProbability, confidence, confidenceFactors = [], reason }) {
  const { t } = useTranslation()
  const style = STYLES[verdict] ?? STYLES.inconclusive
  const Icon = verdict === 'likely_ai' ? WarningIcon : verdict === 'likely_real' ? CheckIcon : QuestionIcon

  return (
    <section className="w-full max-w-4xl" aria-live="polite">
      <h2 className="text-base font-medium text-white mb-4">{t('verdict.result_title')}</h2>
      <div className={`flex items-center gap-4 p-4 rounded-xl ${style.box}`}>
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 text-white flex-shrink-0">
          <Icon />
        </span>
        <div className="min-w-0">
          <p className="text-white font-bold text-lg leading-tight">{t(`verdict.band_${verdict}`)}</p>
          <p className="text-white/90 text-sm mt-0.5">
            {t('verdict.ai_probability', { value: fakeProbability ?? 0 })}
            {confidence != null && <> · {t('verdict.confidence', { value: confidence })}</>}
          </p>
        </div>
      </div>
      <p className="text-slate-400 text-sm mt-3">{reason || t(`verdict.band_${verdict}_explainer`)}</p>
      {confidenceFactors.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-2">
          {confidenceFactors.map((f) => (
            <li key={f} className={`text-xs px-2 py-1 rounded-full bg-slate-800 ring-1 ${style.ring} ${style.text}`}>
              {t(`verdict.factor_${f}`)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
