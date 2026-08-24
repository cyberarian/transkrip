import { isValidOllamaModelName } from './correction-model.ts'

const MAX_TAGS_RESPONSE_CHARS = 1_000_000

export type LocalOllamaModel = {
  name: string
  size: number | null
  family: string | null
  parameterSize: string | null
  quantization: string | null
}

function safeShortString(value: unknown) {
  return typeof value === 'string'
    && value.length <= 100
    && !Array.from(value).some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
    ? value
    : null
}

export function parseOllamaModels(value: unknown): LocalOllamaModel[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { models?: unknown }).models)) {
    throw new Error('Daftar model Ollama tidak valid.')
  }

  const models: LocalOllamaModel[] = []
  for (const item of (value as { models: unknown[] }).models.slice(0, 1_000)) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (!isValidOllamaModelName(record.name)) continue
    const details = record.details && typeof record.details === 'object' ? record.details as Record<string, unknown> : {}
    models.push({
      name: record.name,
      size: typeof record.size === 'number' && Number.isFinite(record.size) && record.size >= 0 ? record.size : null,
      family: safeShortString(details.family),
      parameterSize: safeShortString(details.parameter_size),
      quantization: safeShortString(details.quantization_level),
    })
  }
  return models
}

export function parseLocalOllamaModelList(value: unknown): LocalOllamaModel[] {
  if (!Array.isArray(value) || value.length > 1_000) throw new Error('Daftar model Ollama tidak valid.')
  const models: LocalOllamaModel[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (!isValidOllamaModelName(record.name)) continue
    models.push({
      name: record.name,
      size: typeof record.size === 'number' && Number.isFinite(record.size) && record.size >= 0 ? record.size : null,
      family: safeShortString(record.family),
      parameterSize: safeShortString(record.parameterSize),
      quantization: safeShortString(record.quantization),
    })
  }
  return models
}

async function readTextWithinLimit(response: Response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      received += chunk.length
      if (received > MAX_TAGS_RESPONSE_CHARS) {
        await reader.cancel()
        throw new Error('Daftar model Ollama melebihi batas aman.')
      }
      chunks.push(chunk)
    }
    chunks.push(decoder.decode())
    return chunks.join('')
  } finally {
    reader.releaseLock()
  }
}

export async function listLocalOllamaModels(signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  const response = await fetcher('/api/runtime/ollama/models', { credentials: 'same-origin', cache: 'no-store', signal, headers: { Accept: 'application/json' } })
  if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('transkrip:unauthenticated'))
  if (!response.ok) throw new Error(`Ollama merespons ${response.status}.`)
  let value: unknown
  try {
    value = JSON.parse(await readTextWithinLimit(response))
  } catch (error) {
    if (error instanceof Error && error.message.includes('batas aman')) throw error
    throw new Error('Ollama mengirim daftar model yang tidak valid.', { cause: error })
  }
  if (!value || typeof value !== 'object') throw new Error('Daftar model Ollama tidak valid.')
  return parseLocalOllamaModelList((value as { data?: unknown }).data)
}
