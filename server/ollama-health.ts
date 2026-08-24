import { DEFAULT_CORRECTION_MODEL, isValidOllamaModelName } from '../src/correction-model.ts'
import { parseOllamaModels, type LocalOllamaModel } from '../src/ollama-models.ts'

const OLLAMA_TAGS_URL = 'http://127.0.0.1:11434/api/tags'
const MAX_RESPONSE_BYTES = 1_000_000
const MAX_MODELS = 10_000

export type OllamaHealthReason = 'unreachable' | 'http_error' | 'invalid_response' | 'timeout' | null
export type OllamaHealthSnapshot = {
  status: 'checking' | 'connected' | 'unavailable'
  checkedAt: string | null
  latencyMs: number | null
  modelCount: number
  recommendedModelAvailable: boolean
  reason: OllamaHealthReason
}

export interface OllamaHealthService {
  snapshot(): OllamaHealthSnapshot
  check(): Promise<OllamaHealthSnapshot>
  models(): Promise<LocalOllamaModel[]>
}

async function readBoundedJson(response: Response) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('invalid_response')
  if (!response.body) throw new Error('invalid_response')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('invalid_response') }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  try { return JSON.parse(text) as unknown } catch { throw new Error('invalid_response') }
}

export class OllamaHealthMonitor implements OllamaHealthService {
  readonly #fetcher: typeof fetch
  #current: OllamaHealthSnapshot = { status: 'checking', checkedAt: null, latencyMs: null, modelCount: 0, recommendedModelAvailable: false, reason: null }
  #inFlight: Promise<OllamaHealthSnapshot> | null = null

  constructor(fetcher: typeof fetch = fetch) { this.#fetcher = fetcher }

  snapshot() { return { ...this.#current } }

  async models() {
    return (await this.#fetchModels()).map(model => ({ ...model }))
  }

  check() {
    if (this.#inFlight) return this.#inFlight
    const started = performance.now()
    this.#current = { ...this.#current, status: 'checking', latencyMs: null, reason: null }
    this.#inFlight = this.#probe(started).finally(() => { this.#inFlight = null })
    return this.#inFlight
  }

  async #probe(started: number) {
    let next: OllamaHealthSnapshot
    try {
      const models = await this.#fetchModels()
      const names = models.map(model => model.name).filter(isValidOllamaModelName)
      next = { status: 'connected', checkedAt: new Date().toISOString(), latencyMs: Math.max(0, Math.round(performance.now() - started)), modelCount: names.length, recommendedModelAvailable: names.includes(DEFAULT_CORRECTION_MODEL), reason: null }
    } catch (error) {
      const reason: Exclude<OllamaHealthReason, null> = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : error instanceof Error && error.message === 'http_error' ? 'http_error' : error instanceof Error && error.message === 'invalid_response' ? 'invalid_response' : 'unreachable'
      next = { status: 'unavailable', checkedAt: new Date().toISOString(), latencyMs: Math.max(0, Math.round(performance.now() - started)), modelCount: 0, recommendedModelAvailable: false, reason }
    }
    this.#current = next
    return { ...next }
  }

  async #fetchModels() {
    const response = await this.#fetcher(OLLAMA_TAGS_URL, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3_000) })
    if (!response.ok) throw new Error('http_error')
    let value: unknown
    try { value = await readBoundedJson(response) } catch { throw new Error('invalid_response') }
    if ((value as { models?: unknown[] })?.models?.length && (value as { models: unknown[] }).models.length > MAX_MODELS) throw new Error('invalid_response')
    try { return parseOllamaModels(value) } catch { throw new Error('invalid_response') }
  }
}
