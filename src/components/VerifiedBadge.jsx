import { useTranslation } from 'react-i18next'

const CheckIcon = () => (
  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

export default function VerifiedBadge({ probability = 15 }) {
  const { t } = useTranslation()
  return (
    <section className="w-full max-w-2xl">
      <h2 className="text-base font-medium text-white mb-4">{t('verified.result')}</h2>
      <div className="flex items-center gap-4 p-4 bg-green-600 rounded-xl">
        <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 text-white flex-shrink-0">
          <CheckIcon />
        </span>
        <p className="text-white font-bold text-lg">{t('verified.verified')}</p>
      </div>
      <p className="text-slate-400 text-sm mt-3">
        {t('verified.authenticity', { value: probability })}
      </p>
    </section>
  )
}
