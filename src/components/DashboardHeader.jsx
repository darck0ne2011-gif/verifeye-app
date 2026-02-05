const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

export default function DashboardHeader({ scansCount = 0, userEmail, onSettingsClick }) {
  const scansLabel = scansCount >= 999999 ? 'Unlimited scans' : `${scansCount} Scans`
  return (
    <header className="flex items-center justify-between w-full px-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_12px_rgba(147,51,234,0.5)] shrink-0">
          V
        </div>
        <div className="flex flex-col min-w-0">
          {userEmail && (
            <span className="text-slate-400 text-sm truncate max-w-[140px]" title={userEmail}>
              {userEmail.length > 24 ? userEmail.slice(0, 21) + '...' : userEmail}
            </span>
          )}
          <span className="text-white font-medium">{scansLabel}</span>
        </div>
      </div>
      <button
        onClick={onSettingsClick}
        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        aria-label="Settings"
      >
        <SettingsIcon />
      </button>
    </header>
  )
}
