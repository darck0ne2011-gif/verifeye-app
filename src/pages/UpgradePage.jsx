import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import DashboardHeader from '../components/DashboardHeader'

function getTiers(t) {
  return [
    {
      id: 'starter',
      name: t('pricing.starter'),
      price: t('pricing.price_free'),
      subtext: t('pricing.free_forever'),
      scans: t('pricing.scans_3'),
      featureKeys: ['feature_3_scans', 'feature_basic'],
      cta: t('pricing.current_plan'),
      highlighted: false,
    },
    {
      id: 'quick_boost',
      name: t('pricing.quick_boost'),
      price: t('pricing.price_499'),
      subtext: t('pricing.refill_anytime'),
      scans: t('pricing.scans_10'),
      featureKeys: ['feature_10_scans', 'feature_basic', 'feature_credits_never_expire'],
      cta: t('pricing.get_10_scans'),
      highlighted: false,
    },
    {
      id: 'pro',
      name: t('pricing.pro'),
      price: t('pricing.price_29'),
      subtext: t('pricing.per_month'),
      scans: t('pricing.scans_50'),
      featureKeys: ['feature_50_scans', 'feature_forensic_pdf', 'feature_priority'],
      cta: t('pricing.upgrade_pro'),
      highlighted: true,
    },
    {
      id: 'elite',
      name: t('pricing.elite'),
      price: t('pricing.price_149'),
      subtext: t('pricing.per_month'),
      scans: t('pricing.unlimited'),
      featureKeys: ['feature_unlimited', 'feature_ai_processing', 'feature_forensic_pdf'],
      cta: t('pricing.go_elite'),
      highlighted: true,
      elite: true,
    },
  ]
}

const CheckIcon = ({ className = '' }) => (
  <svg className={`w-5 h-5 shrink-0 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const StarIcon = ({ className = '' }) => (
  <svg className={`w-5 h-5 shrink-0 ${className}`} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
)

export default function UpgradePage({ onSettingsClick }) {
  const { t } = useTranslation()
  const { user, refreshUser, getAuthHeaders } = useAuth()
  const TIERS = getTiers(t)
  const [quickBoostLoading, setQuickBoostLoading] = useState(false)
  const scansCount = user?.scanCredits ?? 0
  const currentTier = user?.subscriptionTier ?? 'starter'

  const handleSelectPlan = async (tierId) => {
    if (tierId === 'starter' || (tierId === currentTier && tierId !== 'quick_boost')) return
    if (tierId === 'quick_boost') {
      if (quickBoostLoading) return
      setQuickBoostLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/purchase-quick-boost`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        })
        const data = await res.json()
        if (data.success) {
          await refreshUser()
        } else {
          console.error('Quick Boost failed:', data.error)
        }
      } catch (err) {
        console.error('Quick Boost error:', err)
      } finally {
        setQuickBoostLoading(false)
      }
      return
    }
    // TODO: Integrate payment for Pro/Elite (Stripe, etc.)
    console.log('Select plan:', tierId)
  }

  const getButtonClasses = (tier) => {
    const isCurrent = tier.id === 'starter' ? currentTier === 'starter' : currentTier === tier.id
    const isQuickBoost = tier.id === 'quick_boost'
    const isLoading = isQuickBoost && quickBoostLoading
    if (isCurrent && !isQuickBoost) {
      return 'bg-slate-700/60 text-slate-400 border border-slate-600/60 cursor-default'
    }
    if (isLoading) {
      return 'bg-slate-600/80 text-white border border-slate-500 cursor-wait opacity-90'
    }
    if (tier.elite) {
      return 'bg-gradient-to-r from-amber-600 to-amber-500 text-black cursor-pointer hover:from-amber-500 hover:to-amber-400 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:opacity-95'
    }
    if (tier.highlighted) {
      return 'bg-cyan-600 text-white cursor-pointer hover:bg-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:opacity-95'
    }
    return 'bg-slate-600/80 text-white border border-slate-500 cursor-pointer hover:bg-slate-500/90 hover:shadow-[0_0_16px_rgba(148,163,184,0.25)] hover:opacity-95'
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
        scansCount={scansCount}
        userEmail={user?.email}
        subscriptionTier={user?.subscriptionTier}
        onSettingsClick={onSettingsClick}
      />

      <main className="flex-1 px-4 pt-6 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('pricing.title')}</h1>
          <p className="text-slate-400 text-sm">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 max-w-4xl mx-auto sm:grid-cols-2">
          {TIERS.map((tier) => {
            const isElite = tier.elite
            const isCurrent = currentTier === tier.id

            return (
              <div
                key={tier.id}
                className={`
                  relative flex flex-col h-full rounded-2xl border-2 overflow-hidden transition-all duration-300
                  ${isElite
                    ? 'bg-[#050508] border-[#d4af37]/60 shadow-[0_0_40px_rgba(212,175,55,0.12),inset_0_1px_0_rgba(212,175,55,0.08)]'
                    : tier.highlighted
                      ? 'bg-slate-800/80 border-cyan-500/50'
                      : 'bg-slate-800/40 border-slate-700/60'
                  }
                  ${isElite ? 'ring-1 ring-[#d4af37]/25' : ''}
                `}
              >
                {isElite && (
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                )}
                {isElite && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-amber-400 text-xs font-medium">
                    <StarIcon className="w-4 h-4" />
                    {t('pricing.premium')}
                  </div>
                )}

                <div className={`flex flex-col h-full p-6 ${isElite ? 'pt-8' : ''}`}>
                  <h3
                    className={`text-lg font-bold mb-1 ${
                      isElite ? 'text-amber-400' : 'text-white'
                    }`}
                  >
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span
                      className={`text-2xl font-bold ${
                        isElite ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {tier.price}
                    </span>
                    <span className={isElite ? 'text-amber-400/80' : 'text-slate-400'}>
                      {tier.subtext}
                    </span>
                  </div>
                  <p
                    className={`text-sm mb-4 ${
                      isElite ? 'text-amber-300/90' : 'text-cyan-400'
                    }`}
                  >
                    {tier.scans}
                  </p>

                  <ul className="space-y-2.5 mb-6">
                    {tier.featureKeys.map((key, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-2 text-sm ${
                          isElite ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        <CheckIcon
                          className={isElite ? 'text-amber-500' : 'text-cyan-500'}
                        />
                        {t(`pricing.${key}`)}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(tier.id)}
                    className={`mt-auto w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${getButtonClasses(tier)}`}
                  >
                    {quickBoostLoading && tier.id === 'quick_boost'
                      ? t('pricing.adding')
                      : (tier.id === 'starter' && currentTier === 'starter') || (tier.id !== 'starter' && currentTier === tier.id)
                        ? t('pricing.current_plan')
                        : tier.cta}
                  </button>
                </div>

                {isElite && (
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-slate-500 text-xs text-center mt-6">
          {t('pricing.payment_coming_soon')}
        </p>
      </main>
    </div>
  )
}
