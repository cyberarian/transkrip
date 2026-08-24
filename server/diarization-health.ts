const DIARIZATION_HEALTH_URL = 'http://127.0.0.1:8765/health'
const MAX_RESPONSE_BYTES = 1_024

export type DiarizationHealthReason = 'unreachable' | 'http_error' | 'invalid_response' | 'timeout' | null
export type DiarizationHealthSnapshot = {
  status: 'checking' | 'ready' | 'unavailable'
  checkedAt: string | null
  latencyMs: number | null
  reason: DiarizationHealthReason
}

export interface DiarizationHealthService {
  snapshot(): DiarizationHealthSnapshot
  check(): Promise<DiarizationHealthSnapshot>
}

export class DiarizationHealthMonitor implements DiarizationHealthService {
  readonly #fetcher: typeof fetch
  #current: DiarizationHealthSnapshot = { status: 'checking', checkedAt: null, latencyMs: null, reason: null }
  #inFlight: Promise<DiarizationHealthSnapshot> | null = null

  constructor(fetcher: typeof fetch = fetch) { this.#fetcher = fetcher }

  snapshot() { return { ...this.#current } }

  check() {
    if (this.#inFlight) return this.#inFlight
    const started = performance.now()
    this.#current = { ...this.#current, status: 'checking', latencyMs: null, reason: null }
    this.#inFlight = this.#probe(started).finally(() => { this.#inFlight = null })
    return this.#inFlight
  }

  async #probe(started: number) {
    let next: DiarizationHealthSnapshot
    try {
      const response = await this.#fetcher(DIARIZATION_HEALTH_URL, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3_000) })
      if (!response.ok) throw new Error('http_error')
      const declared = Number(response.headers.get('content-length'))
      if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('invalid_response')
      const text = await response.text()
      if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error('invalid_response')
      let value: unknown
      try { value = JSON.parse(text) } catch { throw new Error('invalid_response') }
      if (!value || typeof value !== 'object' || (value as { status?: unknown }).status !== 'ready') throw new Error('invalid_response')
      next = { status: 'ready', checkedAt: new Date().toISOString(), latencyMs: Math.max(0, Math.round(performance.now() - started)), reason: null }
    } catch (error) {
      const reason: Exclude<DiarizationHealthReason, null> = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : error instanceof Error && error.message === 'http_error' ? 'http_error' : error instanceof Error && error.message === 'invalid_response' ? 'invalid_response' : 'unreachable'
      next = { status: 'unavailable', checkedAt: new Date().toISOString(), latencyMs: Math.max(0, Math.round(performance.now() - started)), reason }
    }
    this.#current = next
    return { ...next }
  }
}
