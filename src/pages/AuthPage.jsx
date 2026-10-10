import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/Logo'

const EyeIcon = ({ off }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    {off ? (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    ) : (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </>
    )}
  </svg>
)

export default function AuthPage({ mode = 'login' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, oauthError, clearOauthError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isLogin = mode === 'login'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    clearOauthError()
    setLoading(true)
    try {
      if (isLogin) await login(email, password)
      else await register(email, password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-16 h-16" />
          <h1 className="text-3xl font-bold tracking-tight text-fg mt-4">{t('app.brand')}</h1>
          <p className="text-muted text-sm mt-1">{t('app.tagline')}</p>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-fg mb-5">
            {isLogin ? t('auth.sign_in') : t('auth.create_account')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input"
                placeholder={t('auth.email_placeholder')}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isLogin ? 1 : 8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="input pr-12"
                  placeholder={isLogin ? t('auth.password_placeholder_login') : t('auth.password_placeholder_register')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-0.5 rounded"
                  aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                  tabIndex={-1}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>
            {(error || oauthError) && (
              <p className="text-ai text-sm" role="alert">
                {error || oauthError}
              </p>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t('auth.please_wait') : isLogin ? t('auth.sign_in') : t('auth.create_account')}
            </button>
          </form>
          <p className="mt-6 text-center text-muted text-sm">
            {isLogin ? t('auth.no_account') : t('auth.has_account')}{' '}
            <Link
              to={isLogin ? '/register' : '/login'}
              state={location.state}
              className="text-accent hover:text-accent-hover font-medium"
            >
              {isLogin ? t('auth.register') : t('auth.sign_in')}
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link to="/legal/privacy" className="hover:text-fg">
            {t('settings.privacy_policy')}
          </Link>
          {' · '}
          <Link to="/legal/terms" className="hover:text-fg">
            {t('settings.terms_of_service')}
          </Link>
        </p>
      </div>
    </div>
  )
}
