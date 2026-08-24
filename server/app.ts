import type { IncomingMessage, ServerResponse } from 'node:http'
import { correctTextWithOllama } from './correction.ts'
import { TRANSCRIPTION_STATUSES, transcriptionSearchExpression, type TranscriptionStore } from './database.ts'
import { AudioStaging, diarize } from './diarization.ts'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Segment } from '../src/types.ts'
import type { SpeakerDocument } from '../src/speaker-document.ts'
import { hashPassword, hashSessionToken, newSessionToken, normalizeUsername, verifyPassword } from './auth.ts'
import type { PublicUser, UserRole } from './database.ts'
import { OllamaHealthMonitor, type OllamaHealthService } from './ollama-health.ts'
import { DiarizationHealthMonitor, type DiarizationHealthService } from './diarization-health.ts'
import { isDiarizationMode } from '../src/diarization-mode.ts'
import { isAnalysisPreset, type AnalysisPreset } from '../src/analysis.ts'
import { isValidOllamaModelName } from '../src/correction-model.ts'
import { DocetlClient, type AnalysisDocument, type DocetlService } from './docetl-client.ts'

const MAX_BODY_BYTES = 1_050_000
const MAX_SOURCE_CHARS = 512
const MAX_TEXT_CHARS = 1_000_000

class HttpError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, message: string, code = 'REQUEST_ERROR') { super(message); this.status = status; this.code = code }
}

function send(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers })
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Gunakan Content-Type application/json.')
  const declared = Number(request.headers['content-length'] || 0)
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'Permintaan melebihi batas aman.')
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    received += buffer.length
    if (received > MAX_BODY_BYTES) throw new HttpError(413, 'Permintaan melebihi batas aman.')
    chunks.push(buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> } catch { throw new HttpError(400, 'Dokumen JSON tidak valid.') }
}

async function readBytes(request: IncomingMessage, max = 250 * 1024 * 1024) {
  const declared = Number(request.headers['content-length'] || 0)
  if (!declared || declared > max) throw new HttpError(413, 'Audio melebihi batas aman.')
  const chunks: Buffer[] = []; let received = 0
  for await (const chunk of request) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); received += buffer.length; if (received > max) throw new HttpError(413, 'Audio melebihi batas aman.'); chunks.push(buffer) }
  return Buffer.concat(chunks)
}

function segmentsField(value: unknown): Segment[] {
  if (!Array.isArray(value) || value.length > 20_000 || !value.every(segment => segment && typeof segment === 'object' && typeof segment.id === 'string' && Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.start >= 0 && segment.end > segment.start && typeof segment.text === 'string' && segment.text.length <= 10_000 && ['id', 'en', 'auto'].includes(segment.language))) throw new HttpError(400, 'Segmen transkripsi tidak valid.')
  return value as Segment[]
}

function documentField(value: unknown): SpeakerDocument {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Dokumen pembicara tidak valid.')
  const document = value as SpeakerDocument
  if (!Array.isArray(document.speakers) || !Array.isArray(document.blocks) || document.speakers.length > 100 || document.blocks.length > 20_000) throw new HttpError(400, 'Dokumen pembicara tidak valid.')
  const ids = new Set<string>()
  for (const speaker of document.speakers) { if (!speaker || typeof speaker.id !== 'string' || !speaker.id || speaker.id.length > 100 || typeof speaker.label !== 'string' || !speaker.label.trim() || speaker.label.length > 100 || ids.has(speaker.id)) throw new HttpError(400, 'Daftar pembicara tidak valid.'); ids.add(speaker.id) }
  for (const block of document.blocks) if (!block || typeof block.id !== 'string' || !ids.has(block.speakerId) || typeof block.speakerLabel !== 'string' || block.speakerLabel !== document.speakers.find(s => s.id === block.speakerId)?.label || !Number.isFinite(block.start) || !Number.isFinite(block.end) || block.start < 0 || block.end < block.start || typeof block.text !== 'string' || block.text.length > MAX_TEXT_CHARS) throw new HttpError(400, 'Blok dialog tidak valid.')
  return document
}

function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null || value === '') return fallback
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new HttpError(400, 'Parameter halaman tidak valid.')
  return result
}

function textField(body: Record<string, unknown>, key: string, max: number, allowEmpty = false) {
  const value = body[key]
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max) throw new HttpError(400, `Nilai ${key} tidak valid.`)
  return value
}

function transcriptionIdsField(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8 || !value.every(id => Number.isSafeInteger(id) && id > 0)) throw new HttpError(400, 'Pilih 1–8 transkrip yang valid.', 'INVALID_ANALYSIS_SOURCES')
  const ids = [...new Set(value as number[])]
  if (ids.length !== value.length) throw new HttpError(400, 'Transkrip analisis tidak boleh diduplikasi.', 'INVALID_ANALYSIS_SOURCES')
  return ids
}

const SESSION_COOKIE = 'transkrip_session'
const SESSION_MS = 12 * 60 * 60 * 1000
const DUMMY_CREDENTIAL = { hash: '0'.repeat(64), salt: '0'.repeat(32) }

function cookieValue(request: IncomingMessage, name: string) {
  const entry = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null
}

function sessionCookie(token: string, request: IncomingMessage, maxAge = Math.floor(SESSION_MS / 1000)) {
  const secure = Boolean((request.socket as { encrypted?: boolean }).encrypted)
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

function assertSameOrigin(request: IncomingMessage) {
  const fetchSite = request.headers['sec-fetch-site']
  if (fetchSite === 'cross-site') throw new HttpError(403, 'Permintaan lintas situs ditolak.', 'CSRF_REJECTED')
  const origin = request.headers.origin
  if (!origin) return
  const host = request.headers.host
  if (!host || (origin !== `http://${host}` && origin !== `https://${host}`)) throw new HttpError(403, 'Permintaan lintas situs ditolak.', 'CSRF_REJECTED')
}

function requireRole(user: PublicUser, role: UserRole) {
  if (user.role !== role) throw new HttpError(403, 'Akses administrator diperlukan.', 'FORBIDDEN')
}

class LoginThrottle {
  readonly #attempts = new Map<string, number[]>()
  assertAllowed(key: string, now = Date.now()) {
    const recent = (this.#attempts.get(key) || []).filter(value => value > now - 15 * 60 * 1000)
    this.#attempts.set(key, recent)
    if (recent.length >= 5) throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi nanti.', 'RATE_LIMITED')
  }
  fail(key: string, now = Date.now()) { this.#attempts.set(key, [...(this.#attempts.get(key) || []).filter(value => value > now - 15 * 60 * 1000), now]) }
  clear(key: string) { this.#attempts.delete(key) }
}

export function createApiHandler(store: TranscriptionStore, fetcher: typeof fetch = fetch, staging = new AudioStaging(join(tmpdir(), 'transkrip-audio')), ollama: OllamaHealthService = new OllamaHealthMonitor(fetcher), diarizationHealth: DiarizationHealthService = new DiarizationHealthMonitor(fetcher), docetl: DocetlService = new DocetlClient(fetcher)) {
  const throttle = new LoginThrottle()
  let analysisTail = Promise.resolve()
  const enqueueAnalysis = (ownerUserId: number, id: number, preset: AnalysisPreset, model: string, documents: AnalysisDocument[]) => {
    analysisTail = analysisTail.catch(() => undefined).then(async () => {
      if (!store.startAnalysis(ownerUserId, id)) return
      try { store.completeAnalysis(ownerUserId, id, await docetl.analyze({ preset, model, documents }, phase => { store.setAnalysisProgress(ownerUserId, id, phase) })) }
      catch { store.failAnalysis(ownerUserId, id, 'DocETL atau Ollama lokal tidak dapat menyelesaikan analisis. Periksa layanan lokal, lalu jalankan analisis baru.') }
    })
  }
  return async function handle(request: IncomingMessage, response: ServerResponse) {
    const started = performance.now()
    const requestId = crypto.randomUUID()
    const method = request.method || 'GET'
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    let status = 500
    try {
      if (method === 'GET' && url.pathname === '/api/health') {
        status = 200; send(response, status, { data: { status: 'ok' } }); return
      }
      if (method === 'POST' && url.pathname === '/api/auth/login') {
        assertSameOrigin(request)
        const body = await readBody(request)
        const rawUsername = typeof body.username === 'string' ? body.username : ''
        const password = typeof body.password === 'string' ? body.password : ''
        let username = ''
        try { username = normalizeUsername(rawUsername) } catch { /* generic authentication failure */ }
        const throttleKey = `${request.socket.remoteAddress || 'local'}:${username || 'invalid'}`
        throttle.assertAllowed(throttleKey)
        const found = username ? store.findUserCredential(username) : null
        const valid = password.length <= 128 && await verifyPassword(password, found?.credential ?? DUMMY_CREDENTIAL)
        if (!valid || !found?.user.enabled) { throttle.fail(throttleKey); throw new HttpError(401, 'Username atau password tidak valid.', 'INVALID_CREDENTIALS') }
        throttle.clear(throttleKey)
        const token = newSessionToken()
        const previousToken = cookieValue(request, SESSION_COOKIE)
        if (previousToken) store.revokeSession(hashSessionToken(previousToken))
        store.createSession(hashSessionToken(token), found.user.id, new Date(Date.now() + SESSION_MS).toISOString())
        status = 200; send(response, status, { data: { user: found.user } }, { 'Set-Cookie': sessionCookie(token, request) }); return
      }

      const token = cookieValue(request, SESSION_COOKIE)
      const user = token ? store.getSession(hashSessionToken(token)) : null
      if (!user) throw new HttpError(401, 'Silakan masuk untuk melanjutkan.', 'UNAUTHENTICATED')
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) assertSameOrigin(request)

      if (method === 'GET' && url.pathname === '/api/auth/session') {
        status = 200; send(response, status, { data: { user } }); return
      }
      if (method === 'POST' && url.pathname === '/api/auth/logout') {
        if (token) store.revokeSession(hashSessionToken(token))
        status = 200; send(response, status, { data: { loggedOut: true } }, { 'Set-Cookie': sessionCookie('', request, 0) }); return
      }

      if (method === 'PATCH' && url.pathname === '/api/account/preferences') {
        const body = await readBody(request)
        if (!isDiarizationMode(body.diarizationMode)) throw new HttpError(400, 'Mode diarization tidak valid.', 'INVALID_DIARIZATION_MODE')
        const updated = store.updateDiarizationMode(user.id, body.diarizationMode)
        if (!updated) throw new HttpError(404, 'Pengguna tidak ditemukan.')
        status = 200; send(response, status, { data: { user: updated } }); return
      }

      if (method === 'GET' && url.pathname === '/api/runtime/ollama/models') {
        try { status = 200; send(response, status, { data: await ollama.models() }); return }
        catch { throw new HttpError(503, 'Inventaris model Ollama lokal tidak dapat dibaca.', 'OLLAMA_UNAVAILABLE') }
      }
      if (url.pathname === '/api/runtime/ollama') {
        if (method === 'GET') { status = 200; send(response, status, { data: ollama.snapshot() }); return }
        if (method === 'POST') { status = 200; send(response, status, { data: await ollama.check() }); return }
      }
      if (url.pathname === '/api/runtime/diarization') {
        if (method === 'GET') { status = 200; send(response, status, { data: diarizationHealth.snapshot() }); return }
        if (method === 'POST') { status = 200; send(response, status, { data: await diarizationHealth.check() }); return }
      }
      if (url.pathname === '/api/runtime/docetl') {
        if (method === 'GET') { status = 200; send(response, status, { data: docetl.snapshot() }); return }
        if (method === 'POST') { status = 200; send(response, status, { data: await docetl.check() }); return }
      }

      if (url.pathname === '/api/admin/users') {
        requireRole(user, 'admin')
        if (method === 'GET') {
          const limit = integer(url.searchParams.get('limit'), 100, 1, 100); const offset = integer(url.searchParams.get('offset'), 0, 0, 100_000)
          const result = store.listUsers(limit, offset); status = 200; send(response, status, { data: result.data, pagination: { limit, offset, total: result.total } }); return
        }
        if (method === 'POST') {
          const body = await readBody(request); const username = normalizeUsername(textField(body, 'username', 50)); const displayName = textField(body, 'displayName', 100).trim(); const role = body.role === 'admin' ? 'admin' : 'user'; const credential = await hashPassword(textField(body, 'password', 128))
          try { status = 201; send(response, status, { data: store.createUser(username, displayName, role, credential) }); return } catch (error) { if (/unique/i.test(error instanceof Error ? error.message : '')) throw new HttpError(409, 'Username sudah digunakan.', 'USERNAME_CONFLICT'); throw error }
        }
      }
      const userMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/)
      if (userMatch) {
        requireRole(user, 'admin')
        const targetId = integer(userMatch[1], 0, 1, Number.MAX_SAFE_INTEGER)
        if (method === 'PATCH') {
          const body = await readBody(request)
          const input: { displayName?: string; role?: UserRole; enabled?: boolean; credential?: Awaited<ReturnType<typeof hashPassword>> } = {}
          if ('displayName' in body) input.displayName = textField(body, 'displayName', 100).trim()
          if ('role' in body) { if (body.role !== 'admin' && body.role !== 'user') throw new HttpError(400, 'Peran tidak valid.'); input.role = body.role }
          if ('enabled' in body) { if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'Status akun tidak valid.'); input.enabled = body.enabled }
          if ('password' in body) input.credential = await hashPassword(textField(body, 'password', 128))
          try { const updated = store.updateUser(targetId, input); if (!updated) throw new HttpError(404, 'Pengguna tidak ditemukan.'); status = 200; send(response, status, { data: updated }); return } catch (error) { if ((error as Error).message === 'last-enabled-admin') throw new HttpError(409, 'Administrator aktif terakhir tidak dapat dinonaktifkan atau diturunkan.', 'LAST_ADMIN'); throw error }
        }
        if (method === 'DELETE') {
          const body = await readBody(request); const target = store.getUser(targetId)
          if (!target) throw new HttpError(404, 'Pengguna tidak ditemukan.')
          if (body.confirmation !== target.username) throw new HttpError(400, 'Ketik username pengguna untuk mengonfirmasi penghapusan.', 'CONFIRMATION_REQUIRED')
          try { for (const id of store.listTranscriptionIds(targetId)) staging.remove(id); store.deleteUser(targetId, user.id); status = 200; send(response, status, { data: { deleted: true } }); return } catch (error) { const detail = (error as Error).message; if (detail === 'cannot-delete-self') throw new HttpError(409, 'Akun aktif tidak dapat menghapus dirinya sendiri.', 'CANNOT_DELETE_SELF'); if (detail === 'last-enabled-admin') throw new HttpError(409, 'Administrator aktif terakhir tidak dapat dihapus.', 'LAST_ADMIN'); throw error }
        }
      }
      if (method === 'GET' && url.pathname === '/api/transcriptions') {
        const limit = integer(url.searchParams.get('limit'), 100, 1, 100)
        const offset = integer(url.searchParams.get('offset'), 0, 0, 100_000)
        const query = url.searchParams.get('q')
        if (query !== null) {
          if (query.length > 200 || !transcriptionSearchExpression(query)) throw new HttpError(400, 'Kata pencarian tidak valid.', 'INVALID_SEARCH_QUERY')
          const languageValue = url.searchParams.get('language')
          if (languageValue !== null && !['id', 'en', 'auto'].includes(languageValue)) throw new HttpError(400, 'Filter bahasa tidak valid.', 'INVALID_SEARCH_FILTER')
          const statusValue = url.searchParams.get('status')
          if (statusValue !== null && !TRANSCRIPTION_STATUSES.includes(statusValue as never)) throw new HttpError(400, 'Filter status tidak valid.', 'INVALID_SEARCH_FILTER')
          const result = store.searchTranscriptions(user.id, query, {
            ...(languageValue ? { language: languageValue as 'id' | 'en' | 'auto' } : {}),
            ...(statusValue ? { status: statusValue as typeof TRANSCRIPTION_STATUSES[number] } : {}),
          }, limit, offset)
          status = 200; send(response, status, { data: result.data, pagination: { limit, offset, total: result.total } }); return
        }
        const result = store.listSummaries(user.id, limit, offset)
        status = 200; send(response, status, { data: result.data, pagination: { limit, offset, total: result.total } }); return
      }
      if (method === 'POST' && url.pathname === '/api/transcriptions') {
        const body = await readBody(request)
        const audioSource = textField(body, 'audioFile', MAX_SOURCE_CHARS).trim()
        const language = body.language === 'id' || body.language === 'en' || body.language === 'auto' ? body.language : 'auto'
        if ('diarizationMode' in body && !isDiarizationMode(body.diarizationMode)) throw new HttpError(400, 'Mode diarization tidak valid.', 'INVALID_DIARIZATION_MODE')
        const diarizationMode = isDiarizationMode(body.diarizationMode) ? body.diarizationMode : user.diarizationMode
        status = 201; send(response, status, { data: store.create(user.id, audioSource, language, diarizationMode) }); return
      }

      if (url.pathname === '/api/analyses') {
        if (method === 'GET') {
          const limit = integer(url.searchParams.get('limit'), 50, 1, 100); const offset = integer(url.searchParams.get('offset'), 0, 0, 100_000)
          const result = store.listAnalyses(user.id, limit, offset)
          status = 200; send(response, status, { data: result.data, pagination: { limit, offset, total: result.total } }); return
        }
        if (method === 'POST') {
          const body = await readBody(request)
          if (!isAnalysisPreset(body.preset)) throw new HttpError(400, 'Jenis analisis tidak valid.', 'INVALID_ANALYSIS_PRESET')
          if (!isValidOllamaModelName(body.model)) throw new HttpError(400, 'Nama model Ollama tidak valid.', 'INVALID_MODEL')
          const ids = transcriptionIdsField(body.transcriptionIds)
          const documents: AnalysisDocument[] = []
          let totalChars = 0
          for (const sourceId of ids) {
            const record = store.get(user.id, sourceId)
            if (!record) throw new HttpError(404, 'Transkripsi tidak ditemukan.')
            if (record.status === 'processing') throw new HttpError(409, 'Selesaikan transkripsi sebelum menjalankan analisis.', 'TRANSCRIPTION_INCOMPLETE')
            const text = (record.correctedText || record.rawText).trim()
            if (!text) throw new HttpError(409, 'Transkripsi tidak memiliki teks yang dapat dianalisis.', 'TRANSCRIPTION_EMPTY')
            totalChars += text.length
            if (totalChars > 500_000) throw new HttpError(413, 'Gabungan transkrip melebihi batas analisis lokal 500.000 karakter.', 'ANALYSIS_INPUT_TOO_LARGE')
            documents.push({ id: record.id, source: record.audioFile, text })
          }
          const readiness = await docetl.check()
          if (readiness.status !== 'ready') throw new HttpError(503, readiness.reason === 'dependency_missing' ? 'DocETL belum terpasang pada lingkungan Python lokal.' : 'Layanan DocETL lokal belum siap.', 'DOCETL_UNAVAILABLE')
          if (store.countActiveAnalyses(user.id) >= 2 || store.countActiveAnalyses() >= 8) throw new HttpError(429, 'Antrean analisis lokal sedang penuh. Tunggu pekerjaan aktif selesai, lalu coba lagi.', 'ANALYSIS_QUEUE_FULL')
          const run = store.createAnalysis(user.id, body.preset, body.model, ids, documents.map(document => document.source))
          enqueueAnalysis(user.id, run.id, body.preset, body.model, documents)
          status = 202; send(response, status, { data: run }); return
        }
      }
      const analysisMatch = url.pathname.match(/^\/api\/analyses\/(\d+)$/)
      if (analysisMatch) {
        const analysisId = integer(analysisMatch[1], 0, 1, Number.MAX_SAFE_INTEGER)
        if (method === 'GET') {
          const run = store.getAnalysis(user.id, analysisId); if (!run) throw new HttpError(404, 'Analisis tidak ditemukan.')
          status = 200; send(response, status, { data: run }); return
        }
        if (method === 'DELETE') {
          if (!store.deleteAnalysis(user.id, analysisId)) throw new HttpError(404, 'Analisis tidak ditemukan.')
          status = 200; send(response, status, { data: { deleted: true } }); return
        }
      }

      const match = url.pathname.match(/^\/api\/transcriptions\/(\d+)(?:\/(segments|status|correct|audio|finalize|document|normalize))?$/)
      if (!match) throw new HttpError(404, 'Endpoint tidak ditemukan.')
      const id = integer(match[1], 0, 1, Number.MAX_SAFE_INTEGER)
      const action = match[2]

      if (method === 'GET' && !action) {
        const record = store.get(user.id, id)
        if (!record) throw new HttpError(404, 'Transkripsi tidak ditemukan.')
        status = 200; send(response, status, { data: record }); return
      }
      if (method === 'PUT' && action === 'audio') {
        if (request.headers['content-type'] !== 'audio/wav') throw new HttpError(415, 'Gunakan Content-Type audio/wav.')
        const current = store.get(user.id, id)
        if (!current) throw new HttpError(404, 'Transkripsi tidak ditemukan.')
        if (current.status !== 'processing') throw new HttpError(409, 'Audio hanya dapat dikirim untuk transkripsi aktif.')
        if (current.diarizationMode === 'off') throw new HttpError(409, 'Diarization dinonaktifkan untuk transkripsi ini.', 'DIARIZATION_DISABLED')
        try { staging.write(id, await readBytes(request)) } catch { throw new HttpError(400, 'Audio WAV tidak valid.') }
        status = 204; response.writeHead(status, { 'Cache-Control': 'no-store' }); response.end(); return
      }
      if (method === 'POST' && action === 'finalize') {
        try {
          const current = store.get(user.id, id); if (!current) throw new HttpError(404, 'Transkripsi tidak ditemukan.')
          const segments = segmentsField((await readBody(request)).segments)
          const result = await diarize(staging, id, segments, current.language, fetcher)
          const record = store.finalize(user.id, id, result.document, result.mode); if (!record) throw new HttpError(409, 'Transkripsi tidak dapat diselesaikan.')
          status = 200; send(response, status, { data: record }); return
        } finally { staging.remove(id) }
      }
      if (method === 'PATCH' && action === 'document') {
        const document = documentField((await readBody(request)).document)
        const record = store.saveDocument(user.id, id, document); if (!record) throw new HttpError(store.get(user.id, id) ? 409 : 404, 'Dokumen tidak dapat disimpan.')
        status = 200; send(response, status, { data: record }); return
      }
      if (method === 'POST' && action === 'normalize') {
        const body = await readBody(request); const model = textField(body, 'model', 200); const document = documentField(body.document)
        const blocks = []
        for (const block of document.blocks) { const normalized = await correctTextWithOllama(block.text, model, fetcher, 'dialogue'); blocks.push({ ...block, text: normalized.text }) }
        const record = store.saveDocument(user.id, id, { speakers: document.speakers, blocks }, 'corrected'); if (!record) throw new HttpError(409, 'Normalisasi tidak dapat disimpan.')
        status = 200; send(response, status, { data: record }); return
      }

      if (method === 'POST' && action === 'segments') {
        const text = textField(await readBody(request), 'text', MAX_TEXT_CHARS).trim()
        const record = store.appendSegment(user.id, id, text)
        if (!record) throw new HttpError(store.get(user.id, id) ? 409 : 404, store.get(user.id, id) ? 'Transkripsi ini sudah selesai.' : 'Transkripsi tidak ditemukan.')
        status = 200; send(response, status, { data: record }); return
      }
      if (method === 'PATCH' && action === 'status') {
        const body = await readBody(request)
        if (body.status !== 'completed' && body.status !== 'error') throw new HttpError(400, 'Status transkripsi tidak valid.')
        const record = store.updateStatus(user.id, id, body.status)
        staging.remove(id)
        if (!record) throw new HttpError(store.get(user.id, id) ? 409 : 404, store.get(user.id, id) ? 'Status transkripsi tidak dapat diubah.' : 'Transkripsi tidak ditemukan.')
        status = 200; send(response, status, { data: record }); return
      }
      if (method === 'PATCH' && !action) {
        const correctedText = textField(await readBody(request), 'correctedText', MAX_TEXT_CHARS, true)
        const record = store.saveCorrection(user.id, id, correctedText)
        if (!record) throw new HttpError(store.get(user.id, id) ? 409 : 404, store.get(user.id, id) ? 'Transkripsi masih diproses.' : 'Transkripsi tidak ditemukan.')
        status = 200; send(response, status, { data: record }); return
      }
      if (method === 'POST' && action === 'correct') {
        const model = textField(await readBody(request), 'model', 200)
        const current = store.get(user.id, id)
        if (!current) throw new HttpError(404, 'Transkripsi tidak ditemukan.')
        if (current.status === 'processing') throw new HttpError(409, 'Transkripsi masih diproses.')
        const source = current.correctedText ?? current.rawText
        const result = await correctTextWithOllama(source, model, fetcher)
        const record = store.saveCorrection(user.id, id, result.text, 'corrected')
        if (!record) throw new HttpError(409, 'Transkripsi tidak dapat disimpan.')
        status = 200; send(response, status, { data: record, correction: { changed: result.changed, skipped: result.skipped, model: result.model } }); return
      }
      if (method === 'DELETE' && !action) {
        staging.remove(id)
        if (!store.deleteTranscription(user.id, id)) throw new HttpError(404, 'Transkripsi tidak ditemukan.')
        status = 200; send(response, status, { data: { deleted: true } }); return
      }
      throw new HttpError(404, 'Endpoint tidak ditemukan.')
    } catch (error) {
      status = error instanceof HttpError ? error.status : /Ollama|fetch|timeout/i.test(error instanceof Error ? error.message : '') ? 502 : 500
      const message = error instanceof HttpError ? error.message : status === 502 ? 'Ollama lokal tidak dapat menyelesaikan koreksi.' : 'Arsip lokal mengalami kesalahan.'
      if (!response.headersSent) send(response, status, { error: { code: error instanceof HttpError ? error.code : status === 502 ? 'UPSTREAM_ERROR' : 'INTERNAL_ERROR', message, requestId } })
    } finally {
      const route = url.pathname.replace(/\/\d+(?=\/|$)/g, '/:id')
      console.info(JSON.stringify({ level: status >= 500 ? 'error' : 'info', requestId, method, route, status, durationMs: Math.round(performance.now() - started) }))
    }
  }
}
