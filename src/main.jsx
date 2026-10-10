import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000, retry: 1, refetchOnWindowFocus: true },
  },
})

const Splash = () => (
  <div className="min-h-screen bg-bg flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<Splash />}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </Suspense>
    </ErrorBoundary>
  </StrictMode>
)
