import { analysisResultFromUnknown, isAnalysisPreset, type AnalysisPreset, type AnalysisProgressPhase, type AnalysisResult } from '../src/analysis.ts'
import { isValidOllamaModelName } from '../src/correction-model.ts'

const DOCETL_ORIGIN = 'http://127.0.0.1:8770'
const MAX_HEALTH_BYTES = 2_048
const MAX_RESULT_BYTES = 400_000
const MAX_INPUT_BYTES = 600_000

export type DocetlHealthReason = 'dependency_missing' | 'unreachable' | 'http_error' | 'invalid_response' | 'timeout' | null
export type DocetlHealthSnapshot = {
  status: 'checking' | 'ready' | 'unavailable'
  checkedAt: string | null
  latencyMs: number | null
  version: string | null
  reason: DocetlHealthReason
}
export type AnalysisDocument = { id: number; source: string; text: string }
export type AnalysisInput = { preset: AnalysisPreset; model: string; documents: AnalysisDocument[] }
export type AnalysisProgressReporter = (phase: Extract<AnalysisProgressPhase, 'generating' | 'validating'>) => void

export interface DocetlService {
  snapshot(): DocetlHealthSnapshot
  check(): Promise<DocetlHealthSnapshot>
  analyze(input: AnalysisInput, onProgress?: AnalysisProgressReporter): Promise<AnalysisResult>
}

async function readBounded(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('invalid_response')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) { await reader.cancel(); throw new Error('invalid_response') }
    chunks.push(value)
  }
  const joined = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(joined)
}

function parseJson(text: string) {
  try { return JSON.parse(text) as unknown } catch { throw new Error('invalid_response') }
}

export class DocetlClient implements DocetlService {
  readonly #fetcher: typeof fetch
  #current: DocetlHealthSnapshot = { status: 'checking', checkedAt: null, latencyMs: null, version: null, reason: null }
  #inFlight: Promise<DocetlHealthSnapshot> | null = null

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
    let next: DocetlHealthSnapshot
    try {
      const response = await this.#fetcher(`${DOCETL_ORIGIN}/health`, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3_000) })
      const value = parseJson(await readBounded(response, MAX_HEALTH_BYTES)) as Record<string, unknown>
      if (response.status === 503 && value.status === 'unavailable' && value.reason === 'dependency_missing') throw new Error('dependency_missing')
      if (!response.ok) throw new Error('http_error')
      if (value.status !== 'ready' || typeof value.version !== 'string' || value.version.length > 40) throw new Error('invalid_response')
      next = { status: 'ready', checkedAt: new Date().toISOString(), latencyMs: Math.max(0, Math.round(performance.now() - started)), version: value.version, reason: null }
    } catch (error) {
      const reason: Exclude<DocetlHealthReason, null> = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : error instanceof Error && ['dependency_missing', 'http_error', 'invalid_response'].includes(error.message) ? error.message as Exclude<DocetlHealthReason, null> : 'unreachable'
      next = { status: 'unavailable', checkedAt: new Date().toISOString(), latencyMs: Math.max(0, Math.round(performance.now() - started)), version: null, reason }
    }
    this.#current = next
    return { ...next }
  }

  async analyze(input: AnalysisInput, onProgress?: AnalysisProgressReporter) {
    if (!isAnalysisPreset(input.preset) || !isValidOllamaModelName(input.model) || !Array.isArray(input.documents) || input.documents.length < 1 || input.documents.length > 8) throw new Error('Permintaan analisis tidak valid.')
    if (!input.documents.every(document => Number.isSafeInteger(document.id) && document.id > 0 && typeof document.source === 'string' && document.source.length > 0 && document.source.length <= 512 && typeof document.text === 'string' && document.text.trim() && document.text.length <= 500_000)) throw new Error('Dokumen analisis tidak valid.')
    const body = JSON.stringify(input)
    if (Buffer.byteLength(body) > MAX_INPUT_BYTES) throw new Error('Dokumen analisis melebihi batas aman.')
    onProgress?.('generating')
    const response = await this.#fetcher(`${DOCETL_ORIGIN}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10 * 60_000) })
    onProgress?.('validating')
    const value = parseJson(await readBounded(response, MAX_RESULT_BYTES))
    if (!response.ok) throw new Error('DocETL lokal tidak dapat menyelesaikan analisis.')
    return analysisResultFromUnknown(value)
  }
}
