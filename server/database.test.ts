import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { TranscriptionStore, transcriptionSearchExpression } from './database.ts'
import { DatabaseSync } from 'node:sqlite'

function createStore() {
  const directory = mkdtempSync(join(tmpdir(), 'transkrip-test-'))
  return new TranscriptionStore(join(directory, 'transkrip.sqlite'), { username: 'bootstrap.admin', displayName: 'Bootstrap Admin', credential: { hash: 'a'.repeat(64), salt: 'b'.repeat(32) } })
}

test('creates, appends, completes, edits, and lists a transcription', () => {
  const store = createStore()
  try {
    const created = store.create(1, 'rapat-internal.wav')
    assert.equal(created.status, 'processing')
    assert.equal(created.rawText, '')

    store.appendSegment(1, created.id, 'Kalimat pertama.')
    const appended = store.appendSegment(1, created.id, 'Kalimat kedua.')
    assert.equal(appended?.rawText, 'Kalimat pertama.\n\nKalimat kedua.')

    const completed = store.updateStatus(1, created.id, 'completed')
    assert.equal(completed?.status, 'completed')

    const edited = store.saveCorrection(1, created.id, 'Kalimat pertama.\n\nKalimat kedua!')
    assert.equal(edited?.correctedText, 'Kalimat pertama.\n\nKalimat kedua!')
    assert.equal(edited?.status, 'edited')

    const listed = store.list(1, 20, 0)
    assert.equal(listed.total, 1)
    assert.deepEqual(listed.data[0], edited)
  } finally {
    store.close()
  }
})

test('rejects an invalid status and leaves the stored row unchanged', () => {
  const store = createStore()
  try {
    const created = store.create(1, 'interview.ogg')
    assert.throws(() => store.updateStatus(1, created.id, 'deleted' as never), /status/i)
    assert.equal(store.get(1, created.id)?.status, 'processing')
  } finally {
    store.close()
  }
})

test('returns null for updates to unknown rows', () => {
  const store = createStore()
  try {
    assert.equal(store.appendSegment(1, 999, 'Tidak tersimpan.'), null)
    assert.equal(store.saveCorrection(1, 999, 'Tidak tersimpan.'), null)
  } finally {
    store.close()
  }
})

test('lists bounded summaries without duplicating transcript bodies', () => {
  const store = createStore()
  try {
    const created = store.create(1, 'summary.wav')
    store.appendSegment(1, created.id, 'Isi privat yang panjang.')
    store.updateStatus(1, created.id, 'completed')
    const listed = store.listSummaries(1, 100, 0)

    assert.equal(listed.total, 1)
    assert.deepEqual(Object.keys(listed.data[0]).sort(), ['audioFile', 'audioSource', 'createdAt', 'diarization', 'diarizationMode', 'id', 'language', 'speakers', 'status', 'updatedAt'])
  } finally { store.close() }
})

test('builds a bounded literal-prefix FTS expression instead of accepting query syntax', () => {
  assert.equal(transcriptionSearchExpression('  Rapat Senin  '), '"Rapat" * AND "Senin" *')
  assert.equal(transcriptionSearchExpression('rapat OR private* "quoted"'), '"rapat" * AND "OR" * AND "private" * AND "quoted" *')
  assert.equal(transcriptionSearchExpression('--- !!!'), null)
  assert.equal(transcriptionSearchExpression('satu dua tiga empat lima enam tujuh delapan sembilan'), '"satu" * AND "dua" * AND "tiga" * AND "empat" * AND "lima" * AND "enam" * AND "tujuh" * AND "delapan" *')
})

test('searches filenames and canonical transcript text while keeping the index synchronized', () => {
  const store = createStore()
  try {
    const first = store.create(1, 'rapat-produk.wav', 'id')
    store.appendSegment(1, first.id, 'Tim membahas jadwal peluncuran hari Senin.')
    store.updateStatus(1, first.id, 'completed')
    const second = store.create(1, 'interview.wav', 'en')
    store.appendSegment(1, second.id, 'The team discussed customer research.')
    store.updateStatus(1, second.id, 'completed')

    assert.equal(store.searchTranscriptions(1, 'rapat', {}, 20, 0).data[0].id, first.id)
    assert.equal(store.searchTranscriptions(1, 'peluncur', {}, 20, 0).data[0].id, first.id)
    assert.equal(store.searchTranscriptions(1, 'customer', { language: 'en' }, 20, 0).data[0].id, second.id)

    store.saveCorrection(1, first.id, 'Keputusan final diumumkan hari Selasa.', 'corrected')
    assert.equal(store.searchTranscriptions(1, 'Selasa', { status: 'corrected' }, 20, 0).data[0].id, first.id)
    assert.equal(store.searchTranscriptions(1, 'Senin', {}, 20, 0).total, 1)

    store.deleteTranscription(1, first.id)
    assert.equal(store.searchTranscriptions(1, 'Selasa', {}, 20, 0).total, 0)
  } finally { store.close() }
})

test('search results remain owner scoped even when tenants use identical terms', () => {
  const store = createStore()
  try {
    const second = store.createUser('search.user', 'Search User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    const adminTask = store.create(1, 'admin.wav', 'id')
    store.appendSegment(1, adminTask.id, 'Kode rahasia anggrek.')
    store.updateStatus(1, adminTask.id, 'completed')
    const tenantTask = store.create(second.id, 'tenant.wav', 'id')
    store.appendSegment(second.id, tenantTask.id, 'Anggrek untuk taman kantor.')
    store.updateStatus(second.id, tenantTask.id, 'completed')

    const tenantResults = store.searchTranscriptions(second.id, 'anggrek', {}, 20, 0)
    assert.equal(tenantResults.total, 1)
    assert.equal(tenantResults.data[0].id, tenantTask.id)
    assert.doesNotMatch(tenantResults.data[0].excerpt, /rahasia/i)
  } finally { store.close() }
})

test('persists language and a structured speaker document in canonical columns', () => {
  const store = createStore()
  try {
    const created = store.create(1, 'diskusi.wav', 'id')
    store.appendSegment(1, created.id, 'Selamat pagi.')
    const saved = store.finalize(1, created.id, {
      speakers: [{ id: 'SPEAKER_00', label: 'Pembicara 1' }],
      blocks: [{ id: 'block-1', speakerId: 'SPEAKER_00', speakerLabel: 'Pembicara 1', start: 0, end: 2, text: 'Selamat pagi.' }],
    }, 'local')

    assert.equal(saved?.audioFile, 'diskusi.wav')
    assert.equal(saved?.language, 'id')
    assert.equal(saved?.rawTranscript, 'Selamat pagi.')
    assert.equal(saved?.formattedTranscript[0].speakerLabel, 'Pembicara 1')
    assert.equal(saved?.speakers[0].label, 'Pembicara 1')
    assert.equal(saved?.diarization, 'local')
  } finally { store.close() }
})

test('migrates a legacy completed transcript into an editable default-speaker document', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transkrip-legacy-'))
  const path = join(directory, 'legacy.sqlite')
  const legacy = new DatabaseSync(path)
  legacy.exec("CREATE TABLE transcriptions (id INTEGER PRIMARY KEY, audio_source TEXT NOT NULL, raw_text TEXT NOT NULL, corrected_text TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT; INSERT INTO transcriptions VALUES (1, 'lama.wav', 'teks mentah', 'teks lama disunting', 'edited', '2026-01-01', '2026-01-01')")
  legacy.close()
  const store = new TranscriptionStore(path, { username: 'legacy.admin', displayName: 'Legacy Admin', credential: { hash: 'a'.repeat(64), salt: 'b'.repeat(32) } })
  try {
    const record = store.get(1, 1)
    assert.equal(record?.speakers[0].label, 'Pembicara 1')
    assert.equal(record?.formattedTranscript[0].text, 'teks lama disunting')
    assert.equal(record?.diarization, 'fallback')
  } finally { store.close() }
})

test('isolates each tenant at every repository operation', () => {
  const store = createStore()
  try {
    const second = store.createUser('second.user', 'Second User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    const privateRecord = store.create(1, 'admin-private.wav')
    assert.equal(store.get(second.id, privateRecord.id), null)
    assert.equal(store.appendSegment(second.id, privateRecord.id, 'Cross tenant.'), null)
    assert.equal(store.listSummaries(second.id, 100, 0).total, 0)
    assert.equal(store.deleteTranscription(second.id, privateRecord.id), false)
    assert.ok(store.get(1, privateRecord.id))
  } finally { store.close() }
})

test('protects the last enabled administrator and cascades owned work on user deletion', () => {
  const store = createStore()
  try {
    assert.throws(() => store.updateUser(1, { enabled: false }), /last-enabled-admin/)
    const user = store.createUser('deletable.user', 'Deletable User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    store.create(user.id, 'owned.wav')
    assert.equal(store.deleteUser(user.id, 1), true)
    assert.equal(store.listSummaries(user.id, 100, 0).total, 0)
  } finally { store.close() }
})

test('revokes active sessions when an administrator replaces a credential', () => {
  const store = createStore()
  try {
    const user = store.createUser('session.user', 'Session User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    store.createSession('e'.repeat(64), user.id, new Date(Date.now() + 60_000).toISOString())
    assert.equal(store.getSession('e'.repeat(64))?.id, user.id)
    store.updateUser(user.id, { credential: { hash: 'f'.repeat(64), salt: '1'.repeat(32) } })
    assert.equal(store.getSession('e'.repeat(64)), null)
  } finally { store.close() }
})

test('persists a tenant-scoped diarization preference and effective task mode', () => {
  const store = createStore()
  try {
    const second = store.createUser('mode.user', 'Mode User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    assert.equal(store.getUser(1)?.diarizationMode, 'auto')
    assert.equal(store.updateDiarizationMode(second.id, 'off')?.diarizationMode, 'off')
    assert.equal(store.getUser(1)?.diarizationMode, 'auto')
    assert.equal(store.create(second.id, 'dictation.wav', 'id', 'off').diarizationMode, 'off')
    assert.equal(store.create(second.id, 'interview.wav', 'id', 'required').diarizationMode, 'required')
  } finally { store.close() }
})

test('persists tenant-scoped analysis runs through their lifecycle', () => {
  const store = createStore()
  try {
    const task = store.create(1, 'rapat.wav', 'id')
    store.appendSegment(1, task.id, 'Tim menyetujui rilis pada hari Senin.')
    store.updateStatus(1, task.id, 'completed')
    const created = store.createAnalysis(1, 'meeting_minutes', 'local/model:q4', [task.id], ['rapat.wav'])

    assert.equal(created.status, 'pending')
    assert.equal(created.progressPhase, 'queued')
    assert.deepEqual(created.transcriptionIds, [task.id])
    assert.equal(store.startAnalysis(1, created.id)?.progressPhase, 'preparing')
    assert.equal(store.setAnalysisProgress(1, created.id, 'generating')?.progressPhase, 'generating')
    assert.equal(store.setAnalysisProgress(999, created.id, 'validating'), null)
    assert.equal(store.setAnalysisProgress(1, created.id, 'validating')?.progressPhase, 'validating')

    const completed = store.completeAnalysis(1, created.id, { summary: 'Rapat rilis.', primary: 'Rilis Senin.', secondary: 'Siapkan paket.', tertiary: '' })
    assert.equal(completed?.status, 'completed')
    assert.equal(completed?.progressPhase, 'completed')
    assert.equal(completed?.result?.primary, 'Rilis Senin.')
    assert.equal(store.listAnalyses(1, 20, 0).total, 1)
  } finally { store.close() }
})

test('isolates analysis runs by owner and deletes only an owned run', () => {
  const store = createStore()
  try {
    const second = store.createUser('analysis.user', 'Analysis User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    const created = store.createAnalysis(1, 'action_items', 'local/model:q4', [1], ['private.wav'])
    assert.equal(store.getAnalysis(second.id, created.id), null)
    assert.equal(store.deleteAnalysis(second.id, created.id), false)
    assert.equal(store.deleteAnalysis(1, created.id), true)
    assert.equal(store.getAnalysis(1, created.id), null)
  } finally { store.close() }
})

test('counts active analysis runs per tenant and globally', () => {
  const store = createStore()
  try {
    const second = store.createUser('queue.user', 'Queue User', 'user', { hash: 'c'.repeat(64), salt: 'd'.repeat(32) })
    const first = store.createAnalysis(1, 'meeting_minutes', 'local/model:q4', [1], ['first.wav'])
    store.createAnalysis(1, 'action_items', 'local/model:q4', [2], ['second.wav'])
    store.createAnalysis(second.id, 'meeting_minutes', 'local/model:q4', [3], ['third.wav'])
    assert.equal(store.countActiveAnalyses(1), 2)
    assert.equal(store.countActiveAnalyses(second.id), 1)
    assert.equal(store.countActiveAnalyses(), 3)
    store.startAnalysis(1, first.id)
    store.completeAnalysis(1, first.id, { summary: 'Done', primary: '', secondary: '', tertiary: '' })
    assert.equal(store.countActiveAnalyses(1), 1)
    assert.equal(store.countActiveAnalyses(), 2)
  } finally { store.close() }
})

test('persists owner-scoped workspace checkpoints across restart with idempotent optimistic writes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transkrip-checkpoint-test-'))
  const path = join(directory, 'db.sqlite')
  let store = new TranscriptionStore(path, { username: 'bootstrap.admin', displayName: 'Admin', credential: { hash: 'a'.repeat(64), salt: 'b'.repeat(32) } })
  const checkpoint = { version: 1 as const, audioFile: 'rapat.wav', audioHash: null, duration: 60, position: 12, language: 'id', modelName: 'base', selectedId: null, taskId: null, segments: [], resume: null }
  try {
    assert.equal(store.getWorkspace(1).revision, 0)
    assert.equal(store.saveWorkspace(1, 0, 'first-operation', checkpoint), 1)
    assert.equal(store.saveWorkspace(1, 0, 'first-operation', checkpoint), 1)
    assert.equal(store.saveWorkspace(1, 0, 'stale-tab', checkpoint), null)
    assert.equal(store.getWorkspace(999).checkpoint, null)
    store.close()
    store = new TranscriptionStore(path)
    assert.deepEqual(store.getWorkspace(1), { revision: 1, checkpoint })
    assert.equal(store.saveWorkspace(1, 1, 'second-operation', { ...checkpoint, position: 25 }), 2)
  } finally { store.close() }
})
