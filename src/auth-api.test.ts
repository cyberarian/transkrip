import { describe, expect, it, vi } from 'vitest'
import { AuthApiError, getSession, login, updateDiarizationPreference } from './auth-api'

describe('authentication client', () => {
  it('uses same-origin cookie credentials without exposing a token to JavaScript', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ data: { user: { id: 1, username: 'user', role: 'user' } } }), { status: 200 }))
    const fetcher = request as unknown as typeof fetch
    await login('user', 'password value', fetcher)
    expect(request).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ credentials: 'same-origin' }))
    expect(JSON.stringify(request.mock.calls[0])).not.toContain('token')
  })

  it('preserves structured unauthenticated errors for route guards', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Masuk.' } }), { status: 401 })) as unknown as typeof fetch
    await expect(getSession(fetcher)).rejects.toEqual(new AuthApiError(401, 'UNAUTHENTICATED', 'Masuk.'))
  })

  it('updates only the authenticated account diarization preference', async () => {
    const user = { id: 1, username: 'admin', displayName: 'Admin', role: 'admin', enabled: true, diarizationMode: 'required', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { user } }), { status: 200 }))

    await expect(updateDiarizationPreference('required', fetcher)).resolves.toEqual(user)
    expect(fetcher).toHaveBeenCalledWith('/api/account/preferences', expect.objectContaining({ method: 'PATCH', body: '{"diarizationMode":"required"}' }))
  })
})
