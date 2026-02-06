import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from './context/AuthContext'
import ScanPage from './pages/ScanPage'
import HistoryPage from './pages/HistoryPage'
import ScanSettingsPage from './pages/ScanSettingsPage'
import UpgradePage from './pages/UpgradePage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import BottomNav from './components/BottomNav'
import FloatingScanner from './components/FloatingScanner'

function App() {
  const { t, i18n } = useTranslation()
  const { user, loading, login, register, oauthError, clearOauthError } = useAuth()

  useEffect(() => {
    document.title = t('app.title')
  }, [t, i18n.language])
  const [activeTab, setActiveTab] = useState('home')
  const [showSettings, setShowSettings] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const handleAuthSubmit = async (email, password) => {
    setAuthError('')
    setAuthLoading(true)
    try {
      if (authMode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      setActiveTab('home')
      setShowSettings(false)
      window.history.replaceState({}, '', '/')
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setActiveTab('home')
      setShowSettings(false)
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <AuthPage
        mode={authMode}
        onSwitch={() => {
          setAuthMode((m) => (m === 'login' ? 'register' : 'login'))
          setAuthError('')
          clearOauthError()
        }}
        onSubmit={handleAuthSubmit}
        error={authError || oauthError}
        loading={authLoading}
      />
    )
  }

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />
  }

  return (
    <>
      <FloatingScanner />
      <div className="pb-[100px] min-h-[100dvh]">
        {activeTab === 'home' && (
          <ScanPage onSettingsClick={() => setShowSettings(true)} />
        )}
        {activeTab === 'upgrade' && (
          <UpgradePage onSettingsClick={() => setShowSettings(true)} />
        )}
        {activeTab === 'history' && (
          <HistoryPage
            onSettingsClick={() => setShowSettings(true)}
            onUpgradeClick={() => setActiveTab('upgrade')}
          />
        )}
        {activeTab === 'scan_settings' && (
          <ScanSettingsPage onSettingsClick={() => setShowSettings(true)} />
        )}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  )
}

export default App
