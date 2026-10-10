import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { runScan } from '../api/scans'
import { getLastScanResult, setLastScanResult, clearLastScanResult } from '../utils/lastScanResult'
import DashboardHeader from '../components/DashboardHeader'
import OverlayButton from '../components/OverlayButton'
import DropZone from '../components/DropZone'
import CircularProgressLoader from '../components/CircularProgressLoader'
import { getActiveModels, getMaxCreditsPerScan } from '../utils/scanSettings'
import { getMediaCategory } from '../utils/fileType'
import VerdictScreen from '../components/VerdictScreen'

const ACCEPTED = /^(image|video|audio)\//i

export default function ScanPage({ onSettingsClick, onUpgradeClick }) {
  const { t, i18n } = useTranslation()
  const { user, getAuthHeaders, refreshUser, logout } = useAuth()
  const scansCount = user?.scanCredits ?? 0

  const [selectedFile, setSelectedFile] = useState(null)
  const [view, setView] = useState(() => (getLastScanResult() ? 'verdict' : 'idle'))
  const [scan, setScan] = useState(() => getLastScanResult())
  const [progress, setProgress] = useState({ stage: 'queued', progress: 0 })
  const fileInputRef = useRef(null)
  const scansCountRef = useRef(scansCount)
  scansCountRef.current = scansCount

  useEffect(() => {
    if (scan) setLastScanResult(scan)
  }, [scan])

  const handleFileSelect = useCallback((files) => {
    const file = files?.[0]
    if (!file || scansCountRef.current <= 0) return
    if (!ACCEPTED.test(file.type || '')) return
    setSelectedFile(file)
  }, [])

  const handleStartScan = useCallback(async () => {
    const file = selectedFile
    if (!file) return
    const models = getActiveModels(getMediaCategory(file))
    if (scansCountRef.current < models.length) return

    setView('scanning')
    setProgress({ stage: 'uploading', progress: 0 })
    try {
      const result = await runScan(
        file,
        { models, language: i18n.language || 'en' },
        { authHeaders: getAuthHeaders(), onProgress: (p) => setProgress(p) }
      )
      setScan({ result, error: null })
    } catch (err) {
      if (err.status === 401) {
        logout()
        return
      }
      setScan({ result: null, error: err.message || t('scan.network_error') })
    } finally {
      refreshUser()
      setView('verdict')
    }
  }, [selectedFile, getAuthHeaders, refreshUser, logout, t, i18n.language])

  const handleBackToScan = useCallback(() => {
    clearLastScanResult()
    setScan(null)
    setSelectedFile(null)
    setView('idle')
  }, [])

  const creditsNeeded = selectedFile ? getActiveModels(getMediaCategory(selectedFile)).length : getMaxCreditsPerScan()
  const canStart = view === 'idle' && !!selectedFile && scansCount >= creditsNeeded

  const handleOverlayClick = useCallback(() => {
    if (view === 'verdict') handleBackToScan()
    else if (canStart) handleStartScan()
  }, [view, canStart, handleBackToScan, handleStartScan])

  const triggerFileSelect = useCallback(() => {
    if (scansCountRef.current <= 0) return
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col pb-20">
      <DashboardHeader
        scansCount={scansCount}
        userEmail={user?.email}
        subscriptionTier={user?.subscriptionTier}
        onSettingsClick={onSettingsClick}
      />

      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-8 overflow-y-auto min-h-0">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          {view !== 'scanning' && (
            <OverlayButton
              onClick={handleOverlayClick}
              disabled={view === 'idle' && !canStart}
              faded={view === 'idle' && !selectedFile && scansCount >= creditsNeeded}
              mode={view === 'verdict' ? 'newScan' : 'default'}
            />
          )}

          {view === 'idle' && (
            <p className="mt-6 text-slate-400 text-sm text-center max-w-xs shrink-0">{t('scan.protection_active')}</p>
          )}

          <div className="flex-1 w-full mt-8 flex flex-col items-center gap-4 min-h-0">
            {view === 'scanning' && (
              <div className="w-full animate-fade-in">
                <CircularProgressLoader progress={progress.progress} stage={progress.stage} />
              </div>
            )}
            {view === 'verdict' && scan && (
              <VerdictScreen
                result={scan.result}
                error={scan.error}
                canDownloadPdf={true}
                onUpgradeClick={onUpgradeClick}
              />
            )}
          </div>

          {view === 'idle' && (
            <div className="w-full pt-4 shrink-0">
              <DropZone
                disabled={scansCount < creditsNeeded}
                selectedFile={selectedFile}
                creditsNeeded={creditsNeeded}
                onDrop={(files) => handleFileSelect(files)}
                onTriggerClick={triggerFileSelect}
                onClearFile={() => setSelectedFile(null)}
              />
            </div>
          )}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files?.length) handleFileSelect(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
