import { useTranslation } from 'react-i18next'

const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

export default function DashboardHeader({ scansCount = 0, userEmail, onSettingsClick, subscriptionTier }) {
  const { t } = useTranslation()
  const isElite = subscriptionTier === 'elite' || scansCount >= 999999
  const scansLabel = isElite ? t('header.scans_unlimited') : t('header.scans', { count: scansCount })
  return (
    <header className="flex items-center justify-between w-full px-4 py-4 max-w-4xl mx-auto">
      <button
        onClick={onSettingsClick}
        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
        aria-label={t('header.menu')}
      >
        <MenuIcon />
      </button>
      <div className="flex items-center gap-3 min-w-[160px] justify-end shrink-0">
        <div className="flex flex-col items-end min-w-0 overflow-hidden">
          {userEmail && (
            <span className="text-slate-400 text-sm truncate max-w-[140px]" title={userEmail}>
              {userEmail.length > 24 ? userEmail.slice(0, 21) + '...' : userEmail}
            </span>
          )}
          <span className="text-white font-medium">{scansLabel}</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-[0_0_12px_rgba(147,51,234,0.5)]">
          <UserIcon />
        </div>
      </div>
    </header>
  )
}
