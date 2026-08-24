export type UserRole = 'admin' | 'user'
import type { DiarizationMode } from './diarization-mode'

export type SessionUser = { id: number; username: string; displayName: string; role: UserRole; enabled: boolean; diarizationMode: DiarizationMode; createdAt: string; updatedAt: string }

type Fetcher = typeof fetch
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export class AuthApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

async function read(response: Response, broadcastUnauthenticated = true) {
  const body = await response.json() as { data?: unknown; pagination?: { limit: number; offset: number; total: number }; error?: { code?: string; message?: string } }
  if (!response.ok) {
    if (broadcastUnauthenticated && response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('transkrip:unauthenticated'))
    throw new AuthApiError(response.status, body.error?.code || 'REQUEST_ERROR', body.error?.message || 'Permintaan akun tidak dapat diselesaikan.')
  }
  return body
}

export async function getSession(fetcher: Fetcher = fetch) {
  return (await read(await fetcher('/api/auth/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } }), false)).data as { user: SessionUser }
}

export async function login(username: string, password: string, fetcher: Fetcher = fetch) {
  return (await read(await fetcher('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: JSON_HEADERS, body: JSON.stringify({ username, password }) }), false)).data as { user: SessionUser }
}

export async function logout(fetcher: Fetcher = fetch) {
  await read(await fetcher('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: JSON_HEADERS, body: '{}' }))
}

export async function updateDiarizationPreference(diarizationMode: DiarizationMode, fetcher: Fetcher = fetch) {
  const body = await read(await fetcher('/api/account/preferences', { method: 'PATCH', credentials: 'same-origin', headers: JSON_HEADERS, body: JSON.stringify({ diarizationMode }) }))
  return (body.data as { user: SessionUser }).user
}

export async function listUsers(fetcher: Fetcher = fetch) {
  const body = await read(await fetcher('/api/admin/users?limit=100&offset=0', { credentials: 'same-origin', headers: { Accept: 'application/json' } }))
  return { data: body.data as SessionUser[], pagination: body.pagination! }
}

export async function createUser(input: { username: string; displayName: string; role: UserRole; password: string }, fetcher: Fetcher = fetch) {
  return (await read(await fetcher('/api/admin/users', { method: 'POST', credentials: 'same-origin', headers: JSON_HEADERS, body: JSON.stringify(input) }))).data as SessionUser
}

export async function updateUser(id: number, input: { displayName?: string; role?: UserRole; enabled?: boolean; password?: string }, fetcher: Fetcher = fetch) {
  return (await read(await fetcher(`/api/admin/users/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: JSON_HEADERS, body: JSON.stringify(input) }))).data as SessionUser
}

export async function deleteUser(id: number, confirmation: string, fetcher: Fetcher = fetch) {
  await read(await fetcher(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'same-origin', headers: JSON_HEADERS, body: JSON.stringify({ confirmation }) }))
}
