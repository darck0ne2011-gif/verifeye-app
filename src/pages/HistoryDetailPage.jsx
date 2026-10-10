import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { fetchHistoryItem, deleteHistoryItem, historyItemToResult } from '../api/history'
import PageHeader from '../components/PageHeader'
import VerdictScreen from '../components/VerdictScreen'
import FactCheckScreen from '../components/FactCheckScreen'
import { formatDate } from './HistoryPage'

export default function HistoryDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { getAuthHeaders } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const query = useQuery({
    queryKey: ['history', id],
    queryFn: () => fetchHistoryItem(id, getAuthHeaders()),
    initialData: () => queryClient.getQueryData(['history'])?.find((x) => String(x.id) === String(id)),
  })

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteHistoryItem(id, getAuthHeaders())
      queryClient.invalidateQueries({ queryKey: ['history'] })
      navigate('/history', { replace: true })
    } catch (err) {
      setError(err.message || t('history.delete_failed'))
      setDeleting(false)
      setConfirm(false)
    }
  }

  const actions = (
    <div className="flex items-center gap-2 shrink-0">
      {confirm ? (
        <>
          <button type="button" className="btn bg-ai text-bg hover:opacity-90" onClick={remove} disabled={deleting}>
            {t('history.confirm_delete')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)} disabled={deleting}>
            {t('history.cancel')}
          </button>
        </>
      ) : (
        <button type="button" className="btn-ghost text-ai" onClick={() => setConfirm(true)}>
          {t('history.delete')}
        </button>
      )}
    </div>
  )

  if (query.isLoading) {
    return (
      <div className="card p-10 flex justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (query.isError || !query.data) {
    return (
      <div className="card p-6 text-center">
        <p className="text-ai text-sm mb-3">{query.error?.message || t('history.load_failed')}</p>
        <Link to="/history" className="btn-secondary">
          {t('history.back')}
        </Link>
      </div>
    )
  }

  const item = query.data
  return (
    <div className="animate-fade-in">
      <Link to="/history" className="text-sm text-muted hover:text-fg inline-flex items-center gap-1 mb-3">
        ← {t('history.back')}
      </Link>
      <PageHeader title={item.fileName} subtitle={formatDate(item.date)} action={actions} />
      {error && (
        <p className="text-sm text-ai mb-3" role="alert">
          {error}
        </p>
      )}
      {item.mediaCategory === 'post' ? (
        <FactCheckScreen result={historyItemToResult(item)} canDownloadPdf />
      ) : (
        <VerdictScreen result={historyItemToResult(item)} canDownloadPdf />
      )}
    </div>
  )
}
