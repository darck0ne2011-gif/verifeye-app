import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import BottomNav from '../components/BottomNav'
import Logo from '../components/Logo'

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
)

/** Header + bottom navigation around every signed-in page. */
export default function AppShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const unlimited = !!user?.unlimitedScans || (user?.scanCredits ?? 0) >= 999999
  const creditsLabel = unlimited ? t('header.scans_unlimited') : t('header.scans', { count: user?.scanCredits ?? 0 })

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur border-b border-line">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0" aria-label={t('app.brand')}>
            <Logo className="w-7 h-7" />
            <span className="font-bold tracking-tight text-fg">VerifEye</span>
          </Link>
          <Link
            to="/account"
            className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 bg-surface-2 border border-line hover:bg-surface-3 transition-colors min-w-0"
            aria-label={t('shell.account')}
          >
            <span className={`text-xs font-medium truncate ${unlimited ? 'text-unclear' : 'text-muted'}`}>
              {creditsLabel}
            </span>
            <span className="w-7 h-7 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <UserIcon />
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-5 pb-28">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
