import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getScan, waitForScan } from '../api/scans'
import { recallFile } from '../lib/fileStore'
import ScanProgress from '../components/ScanProgress'
import VerdictScreen from '../components/VerdictScreen'
import PageHeader from '../components/PageHeader'

/**
 * /scan/:jobId — shows live progress while the job runs and the verdict when
 * it is done. Safe to refresh or open later: the job lives on the server.
 */
export default function ScanResultPage() {
  const { jobId } = useParams()
  const { t } = useTranslation()
  const { getAuthHeaders, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const [state, setState] = useState({
    status: 'loading',
    progress: 0,
    stage: 'queued',
    result: null,
    error: null,
    fileName: null,
  })
  const file = recallFile(jobId)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const headers = getAuthHeaders()
    ;(async () => {
      try {
        const job = await getScan(jobId, headers)
        if (cancelled) return
        if (job.status === 'done') {
          setState({
            status: 'done',
            progress: 100,
            stage: 'done',
            result: job.result,
            error: null,
            fileName: job.fileName,
          })
          return
        }
        if (job.status === 'failed') {
          setState({
            status: 'failed',
            progress: 0,
            stage: 'failed',
            result: null,
            error: job.error?.message,
            fileName: job.fileName,
          })
          return
        }
        setState((s) => ({
          ...s,
          status: 'running',
          stage: job.stage || 'queued',
          progress: job.progress ?? 0,
          fileName: job.fileName,
        }))
        const result = await waitForScan(jobId, {
          authHeaders: headers,
          signal: controller.signal,
          initial: job,
          onProgress: (p) =>
            !cancelled && setState((s) => ({ ...s, status: 'running', stage: p.stage, progress: p.progress })),
        })
        if (cancelled) return
        setState((s) => ({ ...s, status: 'done', progress: 100, stage: 'done', result }))
        queryClient.invalidateQueries({ queryKey: ['history'] })
        refreshUser()
      } catch (err) {
        if (cancelled || err.code === 'CANCELLED') return
        setState((s) => ({ ...s, status: 'failed', error: err.message || t('scan.network_error') }))
        refreshUser()
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const newScan = (
    <Link to="/" className="btn-primary">
      {t('result.new_scan')}
    </Link>
  )

  if (state.status === 'loading' || state.status === 'running') {
    return (
      <div>
        <PageHeader title={t('result.analyzing')} subtitle={t('result.analyzing_hint')} />
        <ScanProgress stage={state.stage} progress={state.progress} fileName={state.fileName ?? file?.name} />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('result.title')} subtitle={state.fileName ?? file?.name} action={newScan} />
      <VerdictScreen result={state.result} error={state.error} file={file} canDownloadPdf />
    </div>
  )
}
