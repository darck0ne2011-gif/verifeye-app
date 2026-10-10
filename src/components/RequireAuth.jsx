import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NativeFileBridge from '../native/NativeFileBridge'

/** Redirects anonymous visitors to the login page, remembering where they wanted to go. */
export default function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return (
    <>
      <NativeFileBridge />
      <Outlet />
    </>
  )
}
