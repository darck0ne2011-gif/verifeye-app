import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import { getScanHistory } from '../utils/scanHistory'
import LegalPage from '../components/LegalPage'

const APP_VERSION = '0.1.2-beta'

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5']

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
)

const TAB_IDS = ['profile', 'security', 'subscription', 'support', 'about']

const DISPLAY_NAME_KEY = 'verifeye_displayname'

function getDisplayName(email) {
  try {
    const stored = localStorage.getItem(DISPLAY_NAME_KEY)
    if (stored) {
      const map = JSON.parse(stored)
      return map[email] || ''
    }
  } catch (_) {}
  return ''
}

function setDisplayName(email, name) {
  try {
    const stored = localStorage.getItem(DISPLAY_NAME_KEY) || '{}'
    const map = JSON.parse(stored)
    map[email] = name
    localStorage.setItem(DISPLAY_NAME_KEY, JSON.stringify(map))
  } catch (_) {}
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ro', label: 'Română' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'ban', label: 'Basa Bali' },
]

export default function SettingsPage({ onBack }) {
  const { t, i18n } = useTranslation()
  const { user, logout, refreshUser, getAuthHeaders } = useAuth()
  const TABS = TAB_IDS.map((id) => ({ id, label: t(`settings.${id}`) }))
  const [activeTab, setActiveTab] = useState('profile')
  const [displayName, setDisplayNameState] = useState('')
  const [displayNameSaved, setDisplayNameSaved] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [legalView, setLegalView] = useState(null)
  const [faqOpen, setFaqOpen] = useState(null)
  const [contactForm, setContactForm] = useState({ name: '', message: '' })
  const [contactLoading, setContactLoading] = useState(false)
  const [contactSuccess, setContactSuccess] = useState(false)

  const email = user?.email || ''
  const scanCredits = user?.scanCredits ?? 0
  const subscriptionTier = user?.subscriptionTier ?? 'starter'
  const canContactSupport = subscriptionTier === 'pro' || subscriptionTier === 'elite'

  useEffect(() => {
    setDisplayNameState(getDisplayName(email))
  }, [email])

  const handleExportData = () => {
    const history = getScanHistory()
    const exportData = {
      exportDate: new Date().toISOString(),
      userEmail: email,
      scanHistory: history,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verifeye-data-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSaveDisplayName = () => {
    setDisplayName(email, displayName)
    setDisplayNameSaved(true)
    setTimeout(() => setDisplayNameSaved(false), 2000)
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError(t('settings.passwords_no_match'))
      return
    }
    if (passwordForm.new.length < 6) {
      setPasswordError(t('settings.password_min_length'))
      return
    }
    setPasswordLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to change password')
      setPasswordSuccess(true)
      setPasswordForm({ current: '', new: '', confirm: '' })
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    if (!contactForm.name.trim() || !contactForm.message.trim()) return
    setContactLoading(true)
    setContactSuccess(false)
    try {
      // Simulated submit - in production, POST to /api/support
      await new Promise((r) => setTimeout(r, 800))
      setContactForm({ name: '', message: '' })
      setContactSuccess(true)
    } catch (err) {
      console.error(err)
    } finally {
      setContactLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to delete account')
      logout()
    } catch (err) {
      setPasswordError(err.message)
    } finally {
      setDeleteLoading(false)
    }
  }

  if (legalView) {
    return <LegalPage type={legalView} onBack={() => setLegalView(null)} />
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-bold text-white">{t('settings.title')}</h1>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-48 shrink-0 border-r border-slate-800 py-4 hidden sm:block">
          <nav className="space-y-0.5 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
          <div className="max-w-xl mx-auto space-y-8">
            {/* Mobile tabs */}
            <div className="sm:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-slate-400 bg-slate-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Profile */}
            {activeTab === 'profile' && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{t('settings.profile')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">{t('settings.language')}</label>
                    <select
                      value={i18n.language?.split('-')[0] || 'en'}
                      onChange={(e) => i18n.changeLanguage(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">{t('settings.display_name')}</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayNameState(e.target.value)}
                      placeholder={t('settings.display_name_placeholder')}
                      className="w-full px-4 py-3 bg-slate-800/60 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    <button
                      onClick={handleSaveDisplayName}
                      className="mt-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-500 transition-colors"
                    >
                      {displayNameSaved ? t('settings.saved') : t('settings.save')}
                    </button>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">{t('settings.registered_email')}</label>
                    <p className="px-4 py-3 bg-slate-800/40 border border-slate-700 rounded-xl text-slate-300">
                      {email}
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    className="w-full py-3 px-4 bg-slate-800/60 border border-slate-600 rounded-xl text-cyan-400 font-medium hover:bg-slate-700/60 transition-colors"
                  >
                    {t('settings.export_data')}
                  </button>
                  <button
                    onClick={logout}
                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    {t('settings.log_out')}
                  </button>
                </div>
              </section>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{t('settings.security')}</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">{t('settings.current_password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword.current ? 'text' : 'password'}
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 bg-slate-800/60 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => ({ ...p, current: !p.current }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
                        aria-label={showPassword.current ? t('auth.hide_password') : t('auth.show_password')}
                        tabIndex={-1}
                      >
                        {showPassword.current ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">{t('settings.new_password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword.new ? 'text' : 'password'}
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 bg-slate-800/60 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => ({ ...p, new: !p.new }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
                        aria-label={showPassword.new ? t('auth.hide_password') : t('auth.show_password')}
                        tabIndex={-1}
                      >
                        {showPassword.new ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">{t('settings.confirm_password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword.confirm ? 'text' : 'password'}
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                        className="w-full px-4 py-3 pr-12 bg-slate-800/60 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => ({ ...p, confirm: !p.confirm }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded"
                        aria-label={showPassword.confirm ? t('auth.hide_password') : t('auth.show_password')}
                        tabIndex={-1}
                      >
                        {showPassword.confirm ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
                  {passwordSuccess && <p className="text-green-400 text-sm">{t('settings.password_updated')}</p>}
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-4 py-2 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-500 disabled:opacity-50"
                  >
                    {passwordLoading ? t('settings.updating') : t('settings.change_password')}
                  </button>
                </form>
                <div className="mt-12 pt-8 border-t border-slate-800">
                  <button
                    onClick={() => setDeleteConfirm(!deleteConfirm)}
                    className="mb-4 px-4 py-2 bg-red-600/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-600/30 transition-colors"
                  >
                    {deleteConfirm ? t('settings.cancel_delete') : t('settings.delete_account')}
                  </button>
                  {deleteConfirm && (
                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm">{t('settings.delete_warning')}</p>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                        className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-500 disabled:opacity-50"
                      >
                        {deleteLoading ? t('settings.deleting') : t('settings.confirm_delete')}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Support & FAQ */}
            {activeTab === 'support' && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{t('settings.support')}</h2>

                <div className="space-y-3 mb-8">
                  {FAQ_KEYS.map((key, i) => (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl shadow-lg"
                      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)' }}
                    >
                      <button
                        onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left text-white font-medium hover:bg-slate-700/20 transition-colors"
                      >
                        <span className="text-sm pr-2">{t(`faq.${key}`)}</span>
                        <svg
                          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {faqOpen === i && (
                        <div className="px-4 pb-4 pt-0 border-t border-slate-700/40">
                          <p className="text-slate-400 text-sm leading-relaxed pt-3">{t(`faq.a${i + 1}`)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  className="rounded-xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl p-4"
                  style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.03)' }}
                >
                  <h3 className="text-white font-medium mb-3">{t('settings.contact_us')}</h3>
                  {!canContactSupport ? (
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {t('settings.support_exclusive')}
                    </p>
                  ) : contactSuccess ? (
                    <p className="text-green-400 text-sm">{t('settings.message_sent')}</p>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-3">
                      <div>
                        <label className="block text-slate-400 text-sm mb-1.5">{t('settings.name')}</label>
                        <input
                          type="text"
                          value={contactForm.name}
                          onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder={t('settings.name_placeholder')}
                          className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-sm mb-1.5">{t('settings.message')}</label>
                        <textarea
                          value={contactForm.message}
                          onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                          placeholder={t('settings.message_placeholder')}
                          rows={4}
                          className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm resize-none"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={contactLoading}
                        className="w-full py-2.5 px-4 bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 text-sm"
                      >
                        {contactLoading ? t('settings.sending') : t('settings.submit')}
                      </button>
                    </form>
                  )}
                </div>
              </section>
            )}

            {/* Subscription */}
            {activeTab === 'subscription' && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{t('settings.subscription')}</h2>
                <div className="p-6 bg-slate-800/60 border border-slate-700 rounded-xl">
                  <p className="text-slate-400 text-sm mb-1">{t('settings.current_balance')}</p>
                  <p className="text-3xl font-bold text-cyan-400">{scanCredits}</p>
                  <p className="text-slate-500 text-sm mt-1">{t('settings.scan_credits_remaining')}</p>
                  <button
                    onClick={() => refreshUser()}
                    className="mt-4 w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
                  >
                    {t('settings.buy_more_credits')}
                  </button>
                  <p className="text-slate-500 text-xs mt-2 text-center">{t('settings.coming_soon')}</p>
                </div>
              </section>
            )}

            {/* About & App Info */}
            {activeTab === 'about' && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">{t('settings.about')}</h2>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  {t('settings.about_text')}
                </p>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-slate-400 text-sm">{t('settings.version')}</span>
                  <span className="text-cyan-400 font-medium">VerifEye v{APP_VERSION}</span>
                  <button
                    className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    {t('settings.check_updates')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-6 text-sm mb-8">
                  <button
                    onClick={() => setActiveTab('support')}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {t('settings.faq_support')}
                  </button>
                  <button
                    onClick={() => setLegalView('privacy')}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {t('settings.privacy_policy')}
                  </button>
                  <button
                    onClick={() => setLegalView('terms')}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {t('settings.terms_of_service')}
                  </button>
                </div>
                <div className="flex justify-center pt-4 opacity-40">
                  <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xl">
                    V
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <footer className="mt-auto shrink-0 px-4 py-6 border-t border-slate-800">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-400">{t('settings.all_systems')}</span>
          </div>
          <p className="text-slate-500 text-xs">
            {t('settings.copyright')}
          </p>
        </div>
      </footer>
    </div>
  )
}
