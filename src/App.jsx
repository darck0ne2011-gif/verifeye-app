import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './context/AuthContext'
import AppShell from './layouts/AppShell'
import RequireAuth from './components/RequireAuth'
import HomePage from './pages/HomePage'
import ScanResultPage from './pages/ScanResultPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import ScanSettingsPage from './pages/ScanSettingsPage'
import UpgradePage from './pages/UpgradePage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import LegalRoute from './pages/LegalRoute'

const Splash = () => (
  <div className="min-h-screen bg-bg flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
  </div>
)

export default function App() {
  const { t, i18n } = useTranslation()
  const { user, loading } = useAuth()

  useEffect(() => {
    document.title = t('app.title')
    document.documentElement.lang = (i18n.language || 'en').split('-')[0]
  }, [t, i18n.language])

  if (loading) return <Splash />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/legal/:type" element={<LegalRoute />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="scan/:jobId" element={<ScanResultPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:id" element={<HistoryDetailPage />} />
          <Route path="models" element={<ScanSettingsPage />} />
          <Route path="upgrade" element={<UpgradePage />} />
        </Route>
        <Route path="account" element={<SettingsPage />} />
        <Route path="account/:tab" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
