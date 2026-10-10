import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { user, loading, oauthError } = useAuth()
  if (loading) return <p>loading</p>
  return (
    <>
      <p>user:{user?.email ?? 'none'}</p>
      <p>error:{oauthError ?? 'none'}</p>
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

describe('AuthProvider OAuth callback', () => {
  it('reads the token from the URL fragment and strips it from the address bar', async () => {
    window.history.replaceState({}, '', '/#auth_token=tok123')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ success: true, user: { id: 1, email: 'me@example.com' } }),
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() => expect(screen.getByText('user:me@example.com')).toBeInTheDocument())
    expect(localStorage.getItem('verifeye_token')).toBe('tok123')
    expect(window.location.hash).toBe('')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/me'), {
      headers: { Authorization: 'Bearer tok123' },
    })
  })

  it('surfaces an OAuth error from the fragment', async () => {
    window.history.replaceState({}, '', '/#auth_error=Sign-in%20failed')
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() => expect(screen.getByText('error:Sign-in failed')).toBeInTheDocument())
    expect(screen.getByText('user:none')).toBeInTheDocument()
  })
})
