import { Navigate, useNavigate, useParams } from 'react-router-dom'
import LegalPage from '../components/LegalPage'

export default function LegalRoute() {
  const { type } = useParams()
  const navigate = useNavigate()
  if (type !== 'privacy' && type !== 'terms') return <Navigate to="/" replace />
  return <LegalPage type={type} onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} />
}
