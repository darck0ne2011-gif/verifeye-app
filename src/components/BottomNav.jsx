const HomeIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const HistoryIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const UpgradeIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function BottomNav({ activeTab = 'home', onTabChange }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'upgrade', label: 'Upgrade', icon: UpgradeIcon, accent: true },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 rounded-t-2xl safe-area-pb z-50">
      <div className="flex items-center justify-around py-3 px-4">
        {navItems.map(({ id, label, icon: Icon, accent }) => {
          const isActive = activeTab === id
          const isAccent = accent
          return (
          <button
            key={id}
            onClick={() => onTabChange?.(id)}
            className={`flex flex-col items-center gap-1 py-1 px-4 transition-colors ${
              isAccent ? 'text-amber-400 hover:text-amber-300' : isActive ? 'text-cyan-400' : 'text-white hover:text-slate-300'
            }`}
          >
            <Icon />
            <span className="text-xs font-medium">{label}</span>
          </button>
        )})}
      </div>
    </nav>
  )
}
