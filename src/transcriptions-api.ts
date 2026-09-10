import { isValidOllamaModelName } from './correction-model'
import type { Segment } from './types'
import type { Speaker, SpeakerBlock, SpeakerDocument } from './speaker-document'
import { parseDiarizationHealthSnapshot, type DiarizationMode } from './diarization-mode'

export type TranscriptionStatus = 'processing' | 'completed' | 'corrected' | 'edited' | 'error'
export type TranscriptionRecord = {
  id: number
  audioFile: string
  audioSource: string
  language: string
  rawTranscript: string
  rawText: string
  formattedTranscript: SpeakerBlock[]
  correctedText: string | null
  speakers: Speaker[]
  diarization: 'pending' | 'local' | 'fallback'
  diarizationMode: DiarizationMode
  status: TranscriptionStatus
  createdAt: string
  updatedAt: string
}
export type TranscriptionSummary = Omit<TranscriptionRecord, 'rawText' | 'rawTranscript' | 'formattedTranscript' | 'correctedText'>
export type TranscriptionSearchResult = TranscriptionSummary & { excerpt: string }
export type TranscriptionSearchFilters = { language?: 'id' | 'en' | 'auto'; status?: TranscriptionStatus }

type Fetcher = typeof fetch
const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function readJson(response: Response) {
  const text = await response.text()
  if (text.length > 2_100_000) throw new Error('Respons arsip lokal melebihi batas aman.')
  let body: unknown
  try { body = JSON.parse(text) } catch { throw new Error('Arsip lokal mengirim respons yang tidak valid.') }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body
      && typeof body.error === 'object' && body.error !== null && 'message' in body.error
      && typeof body.error.message === 'string' ? body.error.message : 'Arsip lokal tidak dapat menyelesaikan permintaan.'
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('transkrip:unauthenticated'))
    throw new Error(message)
  }
  return body as { data: TranscriptionRecord }
}

export async function listTranscriptions(fetcher: Fetcher = fetch) {
  const response = await fetcher('/api/transcriptions?limit=100&offset=0', { headers: { Accept: 'application/json' } })
  const body = await readJson(response) as unknown as { data: TranscriptionSummary[]; pagination: { total: number } }
  return body
}

export async function searchTranscriptions(query: string, filters: TranscriptionSearchFilters = {}, fetcher: Fetcher = fetch) {
  const normalized = query.trim()
  if (!normalized || normalized.length > 200) throw new Error('Kata pencarian harus berisi 1–200 karakter.')
  const params = new URLSearchParams({ q: normalized })
  if (filters.language) params.set('language', filters.language)
  if (filters.status) params.set('status', filters.status)
  params.set('limit', '50')
  params.set('offset', '0')
  const response = await fetcher(`/api/transcriptions?${params}`, { headers: { Accept: 'application/json' } })
  return await readJson(response) as unknown as { data: TranscriptionSearchResult[]; pagination: { limit: number; offset: number; total: number } }
}

export async function getTranscription(id: number, fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}`, { headers: { Accept: 'application/json' } })
  return (await readJson(response)).data
}

export async function createTranscription(audioFile: string, language = 'auto', fetcher: Fetcher = fetch, diarizationMode?: DiarizationMode) {
  const response = await fetcher('/api/transcriptions', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ audioFile, language, ...(diarizationMode ? { diarizationMode } : {}) }) })
  return (await readJson(response)).data
}

export async function checkDiarizationReadiness(fetcher: Fetcher = fetch) {
  const response = await fetcher('/api/runtime/diarization', { method: 'POST', headers: JSON_HEADERS, body: '{}' })
  return parseDiarizationHealthSnapshot((await readJson(response)).data)
}

export async function uploadDiarizationAudio(id: number, wav: Blob, fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}/audio`, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: wav })
  if (!response.ok) await readJson(response)
}

export async function finalizeTranscription(id: number, segments: Segment[], fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}/finalize`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ segments }) })
  return (await readJson(response)).data
}

export async function saveSpeakerDocument(id: number, document: SpeakerDocument, fetcher: Fetcher = fetch, ownerId?: number) {
  const response = await fetcher(`/api/transcriptions/${id}/document`, { method: 'PATCH', headers: { ...JSON_HEADERS, ...(ownerId ? { 'X-Workspace-Owner': String(ownerId) } : {}) }, body: JSON.stringify({ document }) })
  return (await readJson(response)).data
}

export async function normalizeSpeakerDocument(id: number, document: SpeakerDocument, model: string, fetcher: Fetcher = fetch) {
  if (!isValidOllamaModelName(model)) throw new Error('Nama model koreksi tidak valid.')
  const response = await fetcher(`/api/transcriptions/${id}/normalize`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ document, model }) })
  return (await readJson(response)).data
}

export async function appendTranscriptionSegment(id: number, text: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}/segments`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ text }) })
  return (await readJson(response)).data
}

export async function completeTranscription(id: number, status: 'completed' | 'error', fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}/status`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ status }) })
  return (await readJson(response)).data
}

export async function saveTranscription(id: number, correctedText: string, fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ correctedText }) })
  return (await readJson(response)).data
}

export async function correctStoredTranscription(id: number, model: string, fetcher: Fetcher = fetch) {
  if (!isValidOllamaModelName(model)) throw new Error('Nama model koreksi tidak valid.')
  const response = await fetcher(`/api/transcriptions/${id}/correct`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ model }) })
  return (await readJson(response)).data
}

export async function deleteTranscription(id: number, fetcher: Fetcher = fetch) {
  const response = await fetcher(`/api/transcriptions/${id}`, { method: 'DELETE', headers: JSON_HEADERS, body: '{}' })
  await readJson(response)
}
