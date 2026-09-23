import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApiHandler } from './app.ts'
import { hashPassword } from './auth.ts'
import { TranscriptionStore } from './database.ts'
import { AudioStaging } from './diarization.ts'
import type { OllamaHealthService, OllamaHealthSnapshot } from './ollama-health.ts'
import type { DiarizationHealthService, DiarizationHealthSnapshot } from './diarization-health.ts'
import type { DocetlHealthSnapshot, DocetlService } from './docetl-client.ts'

type Result = { status: number; body: Record<string, unknown>; headers: Record<string, string> }

async function invoke(handler: ReturnType<typeof createApiHandler>, method: string, url: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}): Promise<Result> {
  const encoded = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  const request = Readable.from(encoded ? [encoded] : []) as unknown as IncomingMessage
  Object.assign(request, {
    method,
    url,
    headers: { host: '127.0.0.1:8787', ...(encoded ? { 'content-type': 'application/json', 'content-length': String(encoded.length) } : {}), ...(cookie ? { cookie } : {}), ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  })
  let status = 0; let responseBody = ''; let responseHeaders: Record<string, string> = {}; let headersSent = false
  const response = {
    get headersSent() { return headersSent },
    writeHead(code: number, values: Record<string, string>) { status = code; responseHeaders = values; headersSent = true; return this },
    end(value?: string) { responseBody = value || '' },
  } as unknown as ServerResponse
  await handler(request, response)
  return { status, body: responseBody ? JSON.parse(responseBody) : {}, headers: responseHeaders }
}

async function fixture(ollama?: OllamaHealthService, diarizationHealth?: DiarizationHealthService, docetl?: DocetlService) {
  const directory = mkdtempSync(join(tmpdir(), 'transkrip-api-test-'))
  const credential = await hashPassword('bootstrap password value')
  const store = new TranscriptionStore(join(directory, 'db.sqlite'), { username: 'bootstrap.admin', displayName: 'Bootstrap Admin', credential })
  return { store, handler: createApiHandler(store, fetch, new AudioStaging(join(directory, 'staging')), ollama, diarizationHealth, docetl) }
}

async function login(handler: ReturnType<typeof createApiHandler>, username: string, password: string) {
  const response = await invoke(handler, 'POST', '/api/auth/login', { username, password })
  return { response, cookie: response.headers['Set-Cookie']?.split(';')[0] }
}

test('requires authentication and invalidates logout sessions', async () => {
  const { store, handler } = await fixture()
  try {
    assert.equal((await invoke(handler, 'GET', '/api/transcriptions')).status, 401)
    const signedIn = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    assert.equal(signedIn.response.status, 200)
    assert.match(signedIn.response.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/)
    assert.equal((await invoke(handler, 'GET', '/api/auth/session', undefined, signedIn.cookie)).status, 200)
    assert.equal((await invoke(handler, 'POST', '/api/auth/logout', {}, signedIn.cookie)).status, 200)
    assert.equal((await invoke(handler, 'GET', '/api/auth/session', undefined, signedIn.cookie)).status, 401)
  } finally { store.close() }
})

test('enforces administrator RBAC and owner-only transcription CRUD', async () => {
  const { store, handler } = await fixture()
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    const createdUser = await invoke(handler, 'POST', '/api/admin/users', { username: 'tenant.user', displayName: 'Tenant User', role: 'user', password: 'tenant password value' }, admin.cookie)
    assert.equal(createdUser.status, 201)
    const adminTask = await invoke(handler, 'POST', '/api/transcriptions', { audioFile: 'admin-private.wav', language: 'id' }, admin.cookie)
    assert.equal(adminTask.status, 201)

    const tenant = await login(handler, 'tenant.user', 'tenant password value')
    assert.equal((await invoke(handler, 'GET', '/api/admin/users', undefined, tenant.cookie)).status, 403)
    const taskId = (adminTask.body.data as { id: number }).id
    assert.equal((await invoke(handler, 'GET', `/api/transcriptions/${taskId}`, undefined, tenant.cookie)).status, 404)
    assert.equal((await invoke(handler, 'DELETE', `/api/transcriptions/${taskId}`, {}, tenant.cookie)).status, 404)
    assert.equal(((await invoke(handler, 'GET', '/api/transcriptions', undefined, tenant.cookie)).body.pagination as { total: number }).total, 0)
  } finally { store.close() }
})

test('searches only the authenticated owner with bounded filters and excerpts', async () => {
  const { store, handler } = await fixture()
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    const createdUser = await invoke(handler, 'POST', '/api/admin/users', { username: 'search.tenant', displayName: 'Search Tenant', role: 'user', password: 'tenant password value' }, admin.cookie)
    const tenant = await login(handler, 'search.tenant', 'tenant password value')

    const adminTask = store.create(1, 'admin-secret.wav', 'id')
    store.appendSegment(1, adminTask.id, 'Anggrek adalah kode rapat privat administrator.')
    store.updateStatus(1, adminTask.id, 'completed')
    const tenantUserId = (createdUser.body.data as { id: number }).id
    const tenantTask = store.create(tenantUserId, 'interview-anggrek.wav', 'en')
    store.appendSegment(tenantUserId, tenantTask.id, 'Anggrek appears in the customer interview.')
    store.updateStatus(tenantUserId, tenantTask.id, 'completed')

    const response = await invoke(handler, 'GET', '/api/transcriptions?q=anggrek&language=en&status=completed&limit=20&offset=0', undefined, tenant.cookie)
    assert.equal(response.status, 200)
    assert.equal((response.body.pagination as { total: number }).total, 1)
    assert.equal((response.body.data as Array<{ id: number }>)[0].id, tenantTask.id)
    assert.match((response.body.data as Array<{ excerpt: string }>)[0].excerpt, /anggrek/i)
    assert.doesNotMatch(JSON.stringify(response.body), /privat administrator/i)

    const adminResponse = await invoke(handler, 'GET', '/api/transcriptions?q=anggrek', undefined, admin.cookie)
    assert.equal((adminResponse.body.data as Array<{ id: number }>)[0].id, adminTask.id)
    assert.equal((await invoke(handler, 'GET', '/api/transcriptions?q=---', undefined, tenant.cookie)).status, 400)
    assert.equal((await invoke(handler, 'GET', `/api/transcriptions?q=${'a'.repeat(201)}`, undefined, tenant.cookie)).status, 400)
    assert.equal((await invoke(handler, 'GET', '/api/transcriptions?q=anggrek&language=fr', undefined, tenant.cookie)).status, 400)
  } finally { store.close() }
})

test('rejects cross-site authenticated mutations', async () => {
  const { store, handler } = await fixture()
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    const response = await invoke(handler, 'POST', '/api/transcriptions', { audioFile: 'blocked.wav' }, admin.cookie, { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' })
    assert.equal(response.status, 403)
    assert.equal((response.body.error as { code: string }).code, 'CSRF_REJECTED')
  } finally { store.close() }
})

test('exposes authenticated startup status and a same-origin Ollama recheck', async () => {
  const initial: OllamaHealthSnapshot = { status: 'unavailable', checkedAt: '2026-08-14T06:30:00.000Z', latencyMs: 12, modelCount: 0, recommendedModelAvailable: false, reason: 'unreachable' }
  const connected: OllamaHealthSnapshot = { status: 'connected', checkedAt: '2026-08-14T06:31:00.000Z', latencyMs: 8, modelCount: 2, recommendedModelAvailable: true, reason: null }
  const models = [{ name: 'csalab/sahabatai1:llama3_base_Q4_K_M', size: 4_200_000_000, family: 'llama', parameterSize: '8B', quantization: 'Q4_K_M' }]
  const ollama = { snapshot: () => initial, check: async () => connected, models: async () => models }
  const { store, handler } = await fixture(ollama)
  try {
    assert.equal((await invoke(handler, 'GET', '/api/runtime/ollama')).status, 401)
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    assert.deepEqual((await invoke(handler, 'GET', '/api/runtime/ollama', undefined, admin.cookie)).body.data, initial)
    assert.deepEqual((await invoke(handler, 'GET', '/api/runtime/ollama/models', undefined, admin.cookie)).body.data, models)
    assert.deepEqual((await invoke(handler, 'POST', '/api/runtime/ollama', {}, admin.cookie)).body.data, connected)
    assert.equal((await invoke(handler, 'POST', '/api/runtime/ollama', {}, admin.cookie, { origin: 'https://attacker.example' })).status, 403)
  } finally { store.close() }
})

test('persists a validated account diarization mode and applies per-task overrides', async () => {
  const { store, handler } = await fixture()
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    assert.equal(((admin.response.body.data as { user: { diarizationMode: string } }).user).diarizationMode, 'auto')

    const saved = await invoke(handler, 'PATCH', '/api/account/preferences', { diarizationMode: 'required' }, admin.cookie)
    assert.equal(saved.status, 200)
    assert.equal((saved.body.data as { user: { diarizationMode: string } }).user.diarizationMode, 'required')
    assert.equal((await invoke(handler, 'PATCH', '/api/account/preferences', { diarizationMode: 'always' }, admin.cookie)).status, 400)

    const inherited = await invoke(handler, 'POST', '/api/transcriptions', { audioFile: 'interview.wav', language: 'id' }, admin.cookie)
    assert.equal((inherited.body.data as { diarizationMode: string }).diarizationMode, 'required')
    const overridden = await invoke(handler, 'POST', '/api/transcriptions', { audioFile: 'dictation.wav', language: 'id', diarizationMode: 'off' }, admin.cookie)
    assert.equal((overridden.body.data as { diarizationMode: string }).diarizationMode, 'off')
  } finally { store.close() }
})

test('exposes authenticated diarization readiness and rejects audio for Off tasks', async () => {
  const initial: DiarizationHealthSnapshot = { status: 'unavailable', checkedAt: null, latencyMs: null, reason: null }
  const ready: DiarizationHealthSnapshot = { status: 'ready', checkedAt: '2026-08-15T05:30:00.000Z', latencyMs: 4, reason: null }
  const health = { snapshot: () => initial, check: async () => ready }
  const { store, handler } = await fixture(undefined, health)
  try {
    assert.equal((await invoke(handler, 'GET', '/api/runtime/diarization')).status, 401)
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    assert.deepEqual((await invoke(handler, 'GET', '/api/runtime/diarization', undefined, admin.cookie)).body.data, initial)
    assert.deepEqual((await invoke(handler, 'POST', '/api/runtime/diarization', {}, admin.cookie)).body.data, ready)
    const task = await invoke(handler, 'POST', '/api/transcriptions', { audioFile: 'private.wav', diarizationMode: 'off' }, admin.cookie)
    const id = (task.body.data as { id: number }).id
    const upload = await invoke(handler, 'PUT', `/api/transcriptions/${id}/audio`, undefined, admin.cookie, { 'content-type': 'audio/wav', 'content-length': '44' })
    assert.equal(upload.status, 409)
  } finally { store.close() }
})

test('runs and persists a tenant-scoped DocETL analysis job', async () => {
  const health: DocetlHealthSnapshot = { status: 'ready', checkedAt: '2026-08-16T01:00:00.000Z', latencyMs: 3, version: '0.3.0', reason: null }
  const docetl: DocetlService = {
    snapshot: () => health,
    check: async () => health,
    analyze: async input => {
      assert.equal(input.documents[0].source, 'rapat.wav')
      return { summary: 'Rapat produk.', primary: 'Rilis Senin.', secondary: 'Tim menyiapkan paket.', tertiary: '' }
    },
  }
  const { store, handler } = await fixture(undefined, undefined, docetl)
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    assert.deepEqual((await invoke(handler, 'GET', '/api/runtime/docetl', undefined, admin.cookie)).body.data, health)
    const task = store.create(1, 'rapat.wav', 'id')
    store.appendSegment(1, task.id, 'Tim menyetujui rilis pada hari Senin.')
    store.updateStatus(1, task.id, 'completed')

    const created = await invoke(handler, 'POST', '/api/analyses', { preset: 'meeting_minutes', model: 'local/model:q4', transcriptionIds: [task.id] }, admin.cookie)
    assert.equal(created.status, 202)
    const id = (created.body.data as { id: number }).id
    await new Promise(resolve => setImmediate(resolve))
    const result = await invoke(handler, 'GET', `/api/analyses/${id}`, undefined, admin.cookie)
    assert.equal((result.body.data as { status: string }).status, 'completed')
    assert.equal(((result.body.data as { result: { primary: string } }).result).primary, 'Rilis Senin.')
    assert.equal(((await invoke(handler, 'GET', '/api/analyses', undefined, admin.cookie)).body.pagination as { total: number }).total, 1)
  } finally { store.close() }
})

test('rejects cross-tenant and unfinished analysis sources', async () => {
  const health: DocetlHealthSnapshot = { status: 'ready', checkedAt: null, latencyMs: 1, version: '0.3.0', reason: null }
  const docetl: DocetlService = { snapshot: () => health, check: async () => health, analyze: async () => ({ summary: 'x', primary: '', secondary: '', tertiary: '' }) }
  const { store, handler } = await fixture(undefined, undefined, docetl)
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    await invoke(handler, 'POST', '/api/admin/users', { username: 'analysis.tenant', displayName: 'Analysis Tenant', role: 'user', password: 'tenant password value' }, admin.cookie)
    const tenant = await login(handler, 'analysis.tenant', 'tenant password value')
    const privateTask = store.create(1, 'private.wav')
    assert.equal((await invoke(handler, 'POST', '/api/analyses', { preset: 'meeting_minutes', model: 'local/model:q4', transcriptionIds: [privateTask.id] }, tenant.cookie)).status, 404)
    assert.equal((await invoke(handler, 'POST', '/api/analyses', { preset: 'meeting_minutes', model: 'local/model:q4', transcriptionIds: [privateTask.id] }, admin.cookie)).status, 409)
    assert.equal((await invoke(handler, 'POST', '/api/analyses', { preset: 'custom', model: 'local/model:q4', transcriptionIds: [privateTask.id] }, admin.cookie)).status, 400)
  } finally { store.close() }
})

test('bounds queued analysis work per tenant', async () => {
  const health: DocetlHealthSnapshot = { status: 'ready', checkedAt: null, latencyMs: 1, version: '0.3.0', reason: null }
  const docetl: DocetlService = { snapshot: () => health, check: async () => health, analyze: async () => ({ summary: 'x', primary: '', secondary: '', tertiary: '' }) }
  const { store, handler } = await fixture(undefined, undefined, docetl)
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    const task = store.create(1, 'bounded.wav')
    store.appendSegment(1, task.id, 'Bukti rapat lokal.')
    store.updateStatus(1, task.id, 'completed')
    store.createAnalysis(1, 'meeting_minutes', 'local/model:q4', [task.id], ['one.wav'])
    store.createAnalysis(1, 'action_items', 'local/model:q4', [task.id], ['two.wav'])
    const response = await invoke(handler, 'POST', '/api/analyses', { preset: 'meeting_minutes', model: 'local/model:q4', transcriptionIds: [task.id] }, admin.cookie)
    assert.equal(response.status, 429)
    assert.equal((response.body.error as { code: string }).code, 'ANALYSIS_QUEUE_FULL')
  } finally { store.close() }
})

test('workspace checkpoints require the current owner and reject stale, foreign, or audio-bearing snapshots', async () => {
  const { store, handler } = await fixture()
  try {
    assert.equal((await invoke(handler, 'GET', '/api/workspace')).status, 401)
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    const checkpoint = { version: 1, audioFile: 'private.wav', audioHash: null, duration: 60, position: 12, language: 'id', modelName: 'base', selectedId: null, taskId: null, segments: [], resume: null }
    const write = { revision: 0, operationId: 'operation-one', checkpoint }
    assert.equal((await invoke(handler, 'PUT', '/api/workspace', write, admin.cookie)).status, 200)
    assert.equal((await invoke(handler, 'PUT', '/api/workspace', write, admin.cookie)).status, 200)
    assert.equal((await invoke(handler, 'PUT', '/api/workspace', { ...write, operationId: 'stale-tab' }, admin.cookie)).status, 409)
    assert.equal((await invoke(handler, 'PUT', '/api/workspace', { ...write, checkpoint: { ...checkpoint, audio: [1, 2] } }, admin.cookie)).status, 400)
    assert.equal((await invoke(handler, 'PUT', '/api/workspace', write, admin.cookie, { 'x-workspace-owner': '999' })).status, 409)
    await invoke(handler, 'POST', '/api/admin/users', { username: 'checkpoint.tenant', displayName: 'Tenant', role: 'user', password: 'tenant password value' }, admin.cookie)
    const tenant = await login(handler, 'checkpoint.tenant', 'tenant password value')
    assert.deepEqual((await invoke(handler, 'GET', '/api/workspace', undefined, tenant.cookie)).body.data, { revision: 0, checkpoint: null })
    const task = store.create(1, 'private.wav')
    assert.equal((await invoke(handler, 'PUT', '/api/workspace', { ...write, checkpoint: { ...checkpoint, taskId: task.id } }, tenant.cookie)).status, 404)
  } finally { store.close() }
})

test('media preparation requires authentication, same origin, local access, and current owner', async () => {
  const { store, handler } = await fixture()
  try {
    assert.equal((await invoke(handler, 'POST', '/api/media/prepare')).status, 401)
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    assert.equal((await invoke(handler, 'POST', '/api/media/prepare', {}, admin.cookie, { origin: 'https://foreign.example' })).status, 403)
    assert.equal((await invoke(handler, 'POST', '/api/media/prepare', {}, admin.cookie, { host: 'public.example' })).status, 403)
    assert.equal((await invoke(handler, 'POST', '/api/media/prepare', {}, admin.cookie, { 'x-workspace-owner': '99' })).status, 409)
    assert.equal((await invoke(handler, 'POST', '/api/media/prepare', {}, admin.cookie)).status, 415)
  } finally { store.close() }
})

test('analysis persists only references resolved from the authorized source snapshot', async () => {
  const ready: DocetlHealthSnapshot = { status: 'ready', checkedAt: null, latencyMs: 1, version: '0.3.0', reason: null }
  const docetl: DocetlService = { snapshot: () => ready, check: async () => ready, analyze: async input => {
    assert.match(input.documents[0].text, /\[\[T\d+P1\]\]/)
    return { summary: `Kirim Jumat. [[T${input.documents[0].id}P1]]`, primary: '', secondary: '', tertiary: '' }
  } }
  const { store, handler } = await fixture(undefined, undefined, docetl)
  try {
    const admin = await login(handler, 'bootstrap.admin', 'bootstrap password value')
    const task = store.create(1, 'source.wav', 'id')
    store.appendSegment(1, task.id, 'Kirim Jumat.')
    store.finalize(1, task.id, { speakers: [{ id: 'p1', label: 'Budi' }], blocks: [{ id: 's1', speakerId: 'p1', speakerLabel: 'Budi', start: 2, end: 5, text: 'Kirim Jumat.' }] }, 'fallback')
    const response = await invoke(handler, 'POST', '/api/analyses', { preset: 'meeting_minutes', model: 'local:q4', transcriptionIds: [task.id] }, admin.cookie)
    assert.equal(response.status, 202)
    await new Promise(resolve => setImmediate(resolve))
    const run = store.getAnalysis(1, (response.body.data as { id: number }).id)!
    assert.equal(run.status, 'completed')
    assert.equal(run.result?.evidence?.[0].start, 2)
    assert.equal(run.result?.evidence?.[0].quote, 'Kirim Jumat.')
  } finally { store.close() }
})
