import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE } from '../config.js'

function getFallbackAlerts(t) {
  return [
    { id: 'f1', type: 'high_alert', message: t('alerts.fallback_1') },
    { id: 'f2', type: 'verified', message: t('alerts.fallback_2') },
    { id: 'f3', type: 'high_alert', message: t('alerts.fallback_3') },
  ]
}

const RedAlertIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const VerifiedIcon = () => (
  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

function AlertCard({ alert }) {
  const isHighAlert = alert.type === 'high_alert'

  return (
    <div
      className={`
        w-full flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md
        transition-colors
        ${isHighAlert
          ? 'bg-black/20 border-red-500/30 hover:border-red-500/50'
          : 'bg-black/20 border-emerald-500/30 hover:border-emerald-500/50'
        }
      `}
    >
      <span
        className={`
          mt-0.5 shrink-0
          ${isHighAlert ? 'text-red-400' : 'text-emerald-400'}
        `}
      >
        {isHighAlert ? <RedAlertIcon /> : <VerifiedIcon />}
      </span>
      <p className="text-slate-200 text-sm leading-relaxed">{alert.message}</p>
    </div>
  )
}

export default function GlobalAlerts() {
  const { t } = useTranslation()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/alerts`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.alerts) && data.alerts.length > 0) {
          setAlerts(data.alerts)
        } else {
          setAlerts(getFallbackAlerts(t))
        }
      })
      .catch(() => setAlerts(getFallbackAlerts(t)))
      .finally(() => setLoading(false))
  }, [t])

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-6 pt-2">
        <p className="text-slate-500 text-sm">{t('alerts.loading')}</p>
      </div>
    )
  }

  if (alerts.length === 0) return null

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 shrink-0">
      <div
        className="w-full min-w-0 space-y-3 max-h-[180px] overflow-y-auto overflow-x-hidden pr-2 pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/50"
        style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}
      >
        {alerts.map((alert, i) => (
          <AlertCard key={alert.id || i} alert={alert} />
        ))}
      </div>
    </div>
  )
}
