import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE } from '../config.js'
import DashboardHeader from '../components/DashboardHeader'
import { getScanHistory } from '../utils/scanHistory'

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const FileIcon = ({ type }) => {
  const isVideo = /video/i.test(type || '')
  const isAudio = /audio/i.test(type || '')
  if (isVideo) {
    return (
      <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
  if (isAudio) {
    return (
      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    )
  }
  return (
    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function getFileType(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase()
  const videoExt = ['mp4', 'mov', 'avi', 'webm', 'mkv']
  const audioExt = ['mp3', 'wav', 'ogg', 'm4a', 'aac']
  if (videoExt.includes(ext)) return 'video'
  if (audioExt.includes(ext)) return 'audio'
  return 'image'
}

function formatDate(isoString) {
  const d = new Date(isoString)
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const PDF_ALLOWED_TIERS = ['pro', 'elite']

export default function HistoryPage({ onSettingsClick, onUpgradeClick }) {
  const { user, getAuthHeaders } = useAuth()
  const [history, setHistory] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const scansCount = user?.scanCredits ?? 0
  const tier = user?.subscriptionTier ?? 'starter'
  const canDownloadPdf = PDF_ALLOWED_TIERS.includes(tier)

  useEffect(() => {
    setHistory(getScanHistory())
  }, [])

  const handleDownloadReport = async (item) => {
    if (!canDownloadPdf && onUpgradeClick) {
      onUpgradeClick()
      return
    }
    setDownloadingId(item.id)
    try {
      const res = await fetch(`${API_BASE}/api/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          id: item.id,
          fileName: item.fileName,
          date: item.date,
          score: item.score,
          status: item.status,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 403 && data.code === 'UPGRADE_REQUIRED' && onUpgradeClick) {
          onUpgradeClick()
          return
        }
        throw new Error(data.error || 'Download failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `VerifEye-Report-${(item.fileName || 'report').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 40)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
        scansCount={scansCount}
        userEmail={user?.email}
        onSettingsClick={onSettingsClick}
      />

      <main className="flex-1 flex flex-col px-4 pt-6 pb-8">
        <h1 className="text-xl font-bold text-white mb-6">Scan History</h1>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-slate-400 text-center">
              No scans yet. Start by verifying your first file!
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-xl border border-slate-700/50"
              >
                <FileIcon type={getFileType(item.fileName)} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{item.fileName}</p>
                  <p className="text-slate-400 text-sm">{formatDate(item.date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className={`text-sm font-bold ${
                        item.status === 'REAL' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-slate-500 text-xs">{item.score}%</span>
                  </div>
                  <button
                    onClick={() => handleDownloadReport(item)}
                    disabled={downloadingId === item.id}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      canDownloadPdf
                        ? 'text-cyan-400 hover:bg-slate-700/80'
                        : 'text-amber-500/90 hover:bg-slate-700/80'
                    }`}
                    aria-label={canDownloadPdf ? 'Download Report' : 'Upgrade to download PDF'}
                    title={canDownloadPdf ? 'Download Report' : 'Upgrade to Pro or Elite for PDF reports'}
                  >
                    {downloadingId === item.id ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : canDownloadPdf ? (
                      <DownloadIcon />
                    ) : (
                      <LockIcon />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
