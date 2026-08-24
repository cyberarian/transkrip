import { analysisRunFromUnknown, isAnalysisPreset, type AnalysisPreset } from './analysis'
import { isValidOllamaModelName } from './correction-model'

export type DocetlRuntimeStatus = {
  status: 'checking' | 'ready' | 'unavailable'
  checkedAt: string | null
  latencyMs: number | null
  version: string | null
  reason: 'dependency_missing' | 'unreachable' | 'http_error' | 'invalid_response' | 'timeout' | null
}

type Fetcher = typeof fetch
const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }

async function read(response: Response) {
  const text = await response.text()
  if (text.length > 500_000) throw new Error('Respons analisis melebihi batas aman.')
  let body: unknown
  try { body = JSON.parse(text) } catch { throw new Error('Layanan analisis mengirim respons yang tidak valid.') }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? (body as { error?: { message?: unknown } }).error : null
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('transkrip:unauthenticated'))
    throw new Error(error && typeof error.message === 'string' ? error.message : 'Analisis lokal tidak dapat menyelesaikan permintaan.')
  }
  return body as { data?: unknown; pagination?: { total?: unknown } }
}

export async function listAnalyses(fetcher: Fetcher = fetch) {
  const body = await read(await fetcher('/api/analyses?limit=50&offset=0', { headers: { Accept: 'application/json' } }))
  if (!Array.isArray(body.data) || !body.pagination || !Number.isSafeInteger(body.pagination.total)) throw new Error('Daftar analisis tidak valid.')
  return { data: body.data.map(analysisRunFromUnknown), pagination: { total: body.pagination.total as number } }
}

export async function getAnalysis(id: number, fetcher: Fetcher = fetch) {
  return analysisRunFromUnknown((await read(await fetcher(`/api/analyses/${id}`, { headers: { Accept: 'application/json' } }))).data)
}

export async function createAnalysis(preset: AnalysisPreset, model: string, transcriptionIds: number[], fetcher: Fetcher = fetch) {
  if (!isAnalysisPreset(preset) || !isValidOllamaModelName(model) || transcriptionIds.length < 1 || transcriptionIds.length > 8) throw new Error('Permintaan analisis tidak valid.')
  const response = await fetcher('/api/analyses', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ preset, model, transcriptionIds }) })
  return analysisRunFromUnknown((await read(response)).data)
}

export async function deleteAnalysis(id: number, fetcher: Fetcher = fetch) {
  await read(await fetcher(`/api/analyses/${id}`, { method: 'DELETE', headers: JSON_HEADERS, body: '{}' }))
}

export async function checkDocetl(fetcher: Fetcher = fetch) {
  const value = (await read(await fetcher('/api/runtime/docetl', { method: 'POST', headers: JSON_HEADERS, body: '{}' }))).data
  if (!value || typeof value !== 'object') throw new Error('Status DocETL tidak valid.')
  const item = value as Record<string, unknown>
  if (!['checking', 'ready', 'unavailable'].includes(String(item.status)) || (item.checkedAt !== null && typeof item.checkedAt !== 'string') || (item.latencyMs !== null && (!Number.isFinite(item.latencyMs) || (item.latencyMs as number) < 0)) || (item.version !== null && typeof item.version !== 'string') || !['dependency_missing', 'unreachable', 'http_error', 'invalid_response', 'timeout', null].includes(item.reason as never)) throw new Error('Status DocETL tidak valid.')
  return item as DocetlRuntimeStatus
}
