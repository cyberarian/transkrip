export type OllamaRuntimeStatus = {
  status: 'checking' | 'connected' | 'unavailable'
  checkedAt: string | null
  latencyMs: number | null
  modelCount: number
  recommendedModelAvailable: boolean
  reason: 'unreachable' | 'http_error' | 'invalid_response' | 'timeout' | null
}

const statuses = new Set(['checking', 'connected', 'unavailable'])
const reasons = new Set(['unreachable', 'http_error', 'invalid_response', 'timeout'])

export function parseOllamaStatus(value: unknown): OllamaRuntimeStatus {
  if (!value || typeof value !== 'object') throw new Error('Status Ollama tidak valid.')
  const item = value as Record<string, unknown>
  const validCheckedAt = item.checkedAt === null || (typeof item.checkedAt === 'string' && item.checkedAt.length <= 40 && Number.isFinite(Date.parse(item.checkedAt)))
  const validLatency = item.latencyMs === null || (Number.isSafeInteger(item.latencyMs) && Number(item.latencyMs) >= 0 && Number(item.latencyMs) <= 30_000)
  const validCount = Number.isSafeInteger(item.modelCount) && Number(item.modelCount) >= 0 && Number(item.modelCount) <= 10_000
  const validReason = item.reason === null || (typeof item.reason === 'string' && reasons.has(item.reason))
  if (typeof item.status !== 'string' || !statuses.has(item.status) || !validCheckedAt || !validLatency || !validCount || typeof item.recommendedModelAvailable !== 'boolean' || !validReason) throw new Error('Status Ollama tidak valid.')
  return item as OllamaRuntimeStatus
}

async function requestStatus(method: 'GET' | 'POST', fetcher: typeof fetch) {
  const response = await fetcher('/api/runtime/ollama', { method, credentials: 'same-origin', cache: 'no-store' })
  const text = await response.text()
  if (text.length > 16_000) throw new Error('Respons status Ollama melebihi batas aman.')
  let payload: unknown
  try { payload = JSON.parse(text) } catch { throw new Error('Respons status Ollama tidak valid.') }
  if (response.status === 401) window.dispatchEvent(new Event('transkrip:unauthenticated'))
  if (!response.ok) throw new Error((payload as { error?: { message?: string } })?.error?.message || `Status Ollama merespons ${response.status}.`)
  return parseOllamaStatus((payload as { data?: unknown }).data)
}

export function getOllamaStatus(fetcher: typeof fetch = fetch) { return requestStatus('GET', fetcher) }
export function checkOllamaStatus(fetcher: typeof fetch = fetch) { return requestStatus('POST', fetcher) }
