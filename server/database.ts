import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import type { SpeakerBlock, SpeakerDocument } from '../src/speaker-document.ts'
import type { PasswordCredential } from './auth.ts'
import type { DiarizationMode } from '../src/diarization-mode.ts'
import { analysisResultFromUnknown, type AnalysisPreset, type AnalysisProgressPhase, type AnalysisResult, type AnalysisRun, type AnalysisStatus } from '../src/analysis.ts'

export const TRANSCRIPTION_STATUSES = ['processing', 'completed', 'corrected', 'edited', 'error'] as const
export type TranscriptionStatus = typeof TRANSCRIPTION_STATUSES[number]
export type DiarizationState = 'pending' | 'local' | 'fallback'
export type UserRole = 'admin' | 'user'
export type PublicUser = { id: number; username: string; displayName: string; role: UserRole; enabled: boolean; diarizationMode: DiarizationMode; createdAt: string; updatedAt: string }
export type BootstrapAdmin = { username: string; displayName: string; credential: PasswordCredential }

export type TranscriptionRecord = {
  id: number
  audioFile: string
  audioSource: string
  language: string
  rawTranscript: string
  rawText: string
  formattedTranscript: SpeakerBlock[]
  correctedText: string | null
  speakers: SpeakerDocument['speakers']
  diarization: DiarizationState
  diarizationMode: DiarizationMode
  status: TranscriptionStatus
  createdAt: string
  updatedAt: string
  ownerUserId: number
}
export type TranscriptionSummary = Pick<TranscriptionRecord, 'id' | 'audioFile' | 'audioSource' | 'language' | 'speakers' | 'diarization' | 'diarizationMode' | 'status' | 'createdAt' | 'updatedAt'>
export type TranscriptionSearchResult = TranscriptionSummary & { excerpt: string }
export type TranscriptionSearchFilters = { language?: 'id' | 'en' | 'auto'; status?: TranscriptionStatus }

type DatabaseRow = {
  id: number
  audio_source: string
  audio_file: string
  language: string
  raw_text: string
  raw_transcript: string
  corrected_text: string | null
  formatted_transcript: string
  speakers: string
  diarization: DiarizationState
  diarization_mode: DiarizationMode
  status: TranscriptionStatus
  created_at: string
  updated_at: string
  owner_user_id: number
}

type UserRow = { id: number; username: string; display_name: string; role: UserRole; password_hash: string; password_salt: string; enabled: number; diarization_mode: DiarizationMode; created_at: string; updated_at: string }
type AnalysisRow = { id: number; owner_user_id: number; preset: AnalysisPreset; model: string; transcription_ids: string; source_names: string; result_json: string | null; status: AnalysisStatus; progress_phase: AnalysisProgressPhase; error_message: string | null; created_at: string; updated_at: string }

function serializeUser(row: UserRow): PublicUser {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, enabled: row.enabled === 1, diarizationMode: row.diarization_mode, createdAt: row.created_at, updatedAt: row.updated_at }
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T } catch { return fallback }
}

function serialize(row: DatabaseRow): TranscriptionRecord {
  return {
    id: row.id,
    audioFile: row.audio_file,
    audioSource: row.audio_source,
    language: row.language,
    rawTranscript: row.raw_transcript,
    rawText: row.raw_text,
    formattedTranscript: parseJson<SpeakerBlock[]>(row.formatted_transcript, []),
    correctedText: row.corrected_text,
    speakers: parseJson<SpeakerDocument['speakers']>(row.speakers, []),
    diarization: row.diarization,
    diarizationMode: row.diarization_mode,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerUserId: row.owner_user_id,
  }
}

function summarize(record: TranscriptionRecord): TranscriptionSummary {
  return { id: record.id, audioFile: record.audioFile, audioSource: record.audioSource, language: record.language, speakers: record.speakers, diarization: record.diarization, diarizationMode: record.diarizationMode, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt }
}

export function transcriptionSearchExpression(value: string) {
  const terms = value.match(/[\p{L}\p{N}]+/gu)?.slice(0, 8).map(term => [...term].slice(0, 48).join('')).filter(Boolean) ?? []
  return terms.length ? terms.map(term => `"${term}" *`).join(' AND ') : null
}

function serializeAnalysis(row: AnalysisRow): AnalysisRun {
  let result: AnalysisResult | null = null
  if (row.result_json) {
    try { result = analysisResultFromUnknown(JSON.parse(row.result_json)) } catch { result = null }
  }
  return {
    id: row.id,
    preset: row.preset,
    model: row.model,
    transcriptionIds: parseJson<number[]>(row.transcription_ids, []),
    sourceNames: parseJson<string[]>(row.source_names, []),
    result,
    status: row.status,
    progressPhase: row.progress_phase,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TranscriptionStore {
  readonly #database: DatabaseSync
  readonly #get: StatementSync

  constructor(path: string, bootstrapAdmin?: BootstrapAdmin) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    this.#database = new DatabaseSync(path, { timeout: 5_000 })
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audio_source TEXT NOT NULL CHECK(length(audio_source) BETWEEN 1 AND 512),
        raw_text TEXT NOT NULL DEFAULT '' CHECK(length(raw_text) <= 1000000),
        corrected_text TEXT CHECK(corrected_text IS NULL OR length(corrected_text) <= 1000000),
        status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'corrected', 'edited', 'error')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `)
    this.#migrate(bootstrapAdmin)
    this.#initializeSearch()
    this.#database.exec('CREATE INDEX IF NOT EXISTS transcriptions_owner_created_at ON transcriptions(owner_user_id, created_at DESC, id DESC)')
    this.#get = this.#database.prepare('SELECT * FROM transcriptions WHERE id = ? AND owner_user_id = ?')
  }

  #initializeSearch() {
    const exists = Boolean(this.#database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'transcriptions_fts'").get())
    this.#database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
        audio_file,
        raw_transcript,
        corrected_text,
        content='transcriptions',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      );
      CREATE TRIGGER IF NOT EXISTS transcriptions_fts_insert AFTER INSERT ON transcriptions BEGIN
        INSERT INTO transcriptions_fts(rowid, audio_file, raw_transcript, corrected_text)
        VALUES (new.id, new.audio_file, new.raw_transcript, new.corrected_text);
      END;
      CREATE TRIGGER IF NOT EXISTS transcriptions_fts_delete AFTER DELETE ON transcriptions BEGIN
        INSERT INTO transcriptions_fts(transcriptions_fts, rowid, audio_file, raw_transcript, corrected_text)
        VALUES ('delete', old.id, old.audio_file, old.raw_transcript, old.corrected_text);
      END;
      CREATE TRIGGER IF NOT EXISTS transcriptions_fts_update AFTER UPDATE OF audio_file, raw_transcript, corrected_text ON transcriptions BEGIN
        INSERT INTO transcriptions_fts(transcriptions_fts, rowid, audio_file, raw_transcript, corrected_text)
        VALUES ('delete', old.id, old.audio_file, old.raw_transcript, old.corrected_text);
        INSERT INTO transcriptions_fts(rowid, audio_file, raw_transcript, corrected_text)
        VALUES (new.id, new.audio_file, new.raw_transcript, new.corrected_text);
      END;
    `)
    if (!exists) this.#database.exec("INSERT INTO transcriptions_fts(transcriptions_fts) VALUES ('rebuild')")
  }

  #migrate(bootstrapAdmin?: BootstrapAdmin) {
    const columns = new Set((this.#database.prepare('PRAGMA table_info(transcriptions)').all() as Array<{ name: string }>).map(column => column.name))
    const additions = [
      ['audio_file', "TEXT NOT NULL DEFAULT ''"],
      ['language', "TEXT NOT NULL DEFAULT 'auto'"],
      ['raw_transcript', "TEXT NOT NULL DEFAULT ''"],
      ['formatted_transcript', "TEXT NOT NULL DEFAULT '[]'"],
      ['speakers', "TEXT NOT NULL DEFAULT '[]'"],
      ['diarization', "TEXT NOT NULL DEFAULT 'pending'"],
      ['diarization_mode', "TEXT NOT NULL DEFAULT 'auto' CHECK(diarization_mode IN ('auto', 'required', 'off'))"],
    ] as const
    for (const [name, definition] of additions) if (!columns.has(name)) this.#database.exec(`ALTER TABLE transcriptions ADD COLUMN ${name} ${definition}`)
    this.#database.exec(`UPDATE transcriptions SET audio_file = audio_source WHERE audio_file = ''; UPDATE transcriptions SET raw_transcript = raw_text WHERE raw_transcript = '' AND raw_text != ''`)
    const legacy = this.#database.prepare("SELECT id, language, raw_text, corrected_text FROM transcriptions WHERE status != 'processing' AND formatted_transcript = '[]' AND raw_text != ''").all() as Array<{ id: number; language: string; raw_text: string; corrected_text: string | null }>
    const backfill = this.#database.prepare("UPDATE transcriptions SET formatted_transcript = ?, speakers = ?, diarization = 'fallback' WHERE id = ?")
    for (const row of legacy) {
      const speaker = { id: 'SPEAKER_00', label: row.language === 'en' ? 'Speaker 1' : 'Pembicara 1' }
      const text = row.corrected_text?.trim() || row.raw_text
      const block = { id: `legacy-${row.id}`, speakerId: speaker.id, speakerLabel: speaker.label, start: 0, end: 0, text }
      backfill.run(JSON.stringify([block]), JSON.stringify([speaker]), row.id)
    }
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(username) BETWEEN 3 AND 50),
        display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 100),
        role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
        password_hash TEXT NOT NULL CHECK(length(password_hash) = 64),
        password_salt TEXT NOT NULL CHECK(length(password_salt) = 32),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
        diarization_mode TEXT NOT NULL DEFAULT 'auto' CHECK(diarization_mode IN ('auto', 'required', 'off')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sessions (
        id_hash TEXT PRIMARY KEY CHECK(length(id_hash) = 64),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS analysis_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        preset TEXT NOT NULL CHECK(preset IN ('meeting_minutes', 'action_items', 'cross_transcript_themes')),
        model TEXT NOT NULL CHECK(length(model) BETWEEN 1 AND 200),
        transcription_ids TEXT NOT NULL CHECK(length(transcription_ids) BETWEEN 3 AND 512),
        source_names TEXT NOT NULL CHECK(length(source_names) BETWEEN 2 AND 8192),
        result_json TEXT CHECK(result_json IS NULL OR length(result_json) <= 400000),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'error')),
        progress_phase TEXT NOT NULL DEFAULT 'queued' CHECK(progress_phase IN ('queued', 'preparing', 'generating', 'validating', 'completed', 'failed')),
        error_message TEXT CHECK(error_message IS NULL OR length(error_message) <= 500),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      CREATE INDEX IF NOT EXISTS analysis_runs_owner_created_at ON analysis_runs(owner_user_id, created_at DESC, id DESC);
    `)
    const analysisColumns = new Set((this.#database.prepare('PRAGMA table_info(analysis_runs)').all() as Array<{ name: string }>).map(column => column.name))
    if (!analysisColumns.has('progress_phase')) this.#database.exec("ALTER TABLE analysis_runs ADD COLUMN progress_phase TEXT NOT NULL DEFAULT 'queued' CHECK(progress_phase IN ('queued', 'preparing', 'generating', 'validating', 'completed', 'failed'))")
    this.#database.prepare("UPDATE analysis_runs SET status = 'error', progress_phase = 'failed', error_message = 'Proses lokal terhenti saat aplikasi ditutup. Jalankan analisis baru.', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE status IN ('pending', 'running')").run()
    const userColumns = new Set((this.#database.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map(column => column.name))
    if (!userColumns.has('diarization_mode')) this.#database.exec("ALTER TABLE users ADD COLUMN diarization_mode TEXT NOT NULL DEFAULT 'auto' CHECK(diarization_mode IN ('auto', 'required', 'off'))")
    const userCount = (this.#database.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count
    if (userCount === 0) {
      if (!bootstrapAdmin) throw new Error('Database belum memiliki pengguna. Atur TRANSKRIP_ADMIN_USERNAME dan TRANSKRIP_ADMIN_PASSWORD untuk bootstrap admin.')
      this.#database.prepare("INSERT INTO users (username, display_name, role, password_hash, password_salt) VALUES (?, ?, 'admin', ?, ?)").run(bootstrapAdmin.username, bootstrapAdmin.displayName, bootstrapAdmin.credential.hash, bootstrapAdmin.credential.salt)
    }
    const ownerColumns = new Set((this.#database.prepare('PRAGMA table_info(transcriptions)').all() as Array<{ name: string }>).map(column => column.name))
    if (!ownerColumns.has('owner_user_id')) this.#database.exec('ALTER TABLE transcriptions ADD COLUMN owner_user_id INTEGER REFERENCES users(id)')
    const bootstrapId = (this.#database.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get() as { id: number }).id
    this.#database.prepare('UPDATE transcriptions SET owner_user_id = ? WHERE owner_user_id IS NULL').run(bootstrapId)
    this.#database.exec(`
      CREATE TRIGGER IF NOT EXISTS transcriptions_owner_required_insert BEFORE INSERT ON transcriptions WHEN NEW.owner_user_id IS NULL BEGIN SELECT RAISE(ABORT, 'owner_user_id required'); END;
      CREATE TRIGGER IF NOT EXISTS transcriptions_owner_required_update BEFORE UPDATE OF owner_user_id ON transcriptions WHEN NEW.owner_user_id IS NULL BEGIN SELECT RAISE(ABORT, 'owner_user_id required'); END;
    `)
  }

  create(ownerUserId: number, audioFile: string, language = 'auto', diarizationMode: DiarizationMode = 'auto') {
    const result = this.#database.prepare('INSERT INTO transcriptions (audio_source, audio_file, language, diarization_mode, owner_user_id) VALUES (?, ?, ?, ?, ?)').run(audioFile, audioFile, language, diarizationMode, ownerUserId)
    return this.get(ownerUserId, Number(result.lastInsertRowid))!
  }

  get(ownerUserId: number, id: number) { const row = this.#get.get(id, ownerUserId) as DatabaseRow | undefined; return row ? serialize(row) : null }

  list(ownerUserId: number, limit: number, offset: number) {
    const rows = this.#database.prepare('SELECT * FROM transcriptions WHERE owner_user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').all(ownerUserId, limit, offset) as DatabaseRow[]
    const count = this.#database.prepare('SELECT COUNT(*) AS count FROM transcriptions WHERE owner_user_id = ?').get(ownerUserId) as { count: number }
    return { data: rows.map(serialize), total: count.count }
  }

  listSummaries(ownerUserId: number, limit: number, offset: number) {
    const rows = this.#database.prepare('SELECT * FROM transcriptions WHERE owner_user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').all(ownerUserId, limit, offset) as DatabaseRow[]
    const count = this.#database.prepare('SELECT COUNT(*) AS count FROM transcriptions WHERE owner_user_id = ?').get(ownerUserId) as { count: number }
    return { data: rows.map(row => summarize(serialize(row))), total: count.count }
  }

  searchTranscriptions(ownerUserId: number, query: string, filters: TranscriptionSearchFilters, limit: number, offset: number) {
    const expression = transcriptionSearchExpression(query)
    if (!expression) return { data: [] as TranscriptionSearchResult[], total: 0 }
    const language = filters.language ?? null
    const status = filters.status ?? null
    const where = `transcriptions_fts MATCH ? AND transcriptions.owner_user_id = ? AND (? IS NULL OR transcriptions.language = ?) AND (? IS NULL OR transcriptions.status = ?)`
    const rows = this.#database.prepare(`
      SELECT transcriptions.*, snippet(transcriptions_fts, -1, '', '', ' … ', 24) AS excerpt
      FROM transcriptions_fts
      JOIN transcriptions ON transcriptions.id = transcriptions_fts.rowid
      WHERE ${where}
      ORDER BY bm25(transcriptions_fts), transcriptions.created_at DESC, transcriptions.id DESC
      LIMIT ? OFFSET ?
    `).all(expression, ownerUserId, language, language, status, status, limit, offset) as Array<DatabaseRow & { excerpt: string }>
    const count = this.#database.prepare(`
      SELECT COUNT(*) AS count
      FROM transcriptions_fts
      JOIN transcriptions ON transcriptions.id = transcriptions_fts.rowid
      WHERE ${where}
    `).get(expression, ownerUserId, language, language, status, status) as { count: number }
    return { data: rows.map(row => ({ ...summarize(serialize(row)), excerpt: String(row.excerpt || '').slice(0, 500) })), total: count.count }
  }

  appendSegment(ownerUserId: number, id: number, text: string) {
    const result = this.#database.prepare(`UPDATE transcriptions SET raw_text = CASE WHEN raw_text = '' THEN ? ELSE raw_text || '\n\n' || ? END, raw_transcript = CASE WHEN raw_transcript = '' THEN ? ELSE raw_transcript || '\n\n' || ? END, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status = 'processing'`).run(text, text, text, text, id, ownerUserId)
    return result.changes ? this.get(ownerUserId, id) : null
  }

  finalize(ownerUserId: number, id: number, document: SpeakerDocument, diarization: 'local' | 'fallback') {
    const formatted = JSON.stringify(document.blocks)
    const speakers = JSON.stringify(document.speakers)
    const corrected = document.blocks.map(block => `${block.speakerLabel}:\n${block.text}`).join('\n\n')
    const result = this.#database.prepare(`UPDATE transcriptions SET formatted_transcript = ?, speakers = ?, corrected_text = ?, diarization = ?, status = 'completed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status = 'processing'`).run(formatted, speakers, corrected, diarization, id, ownerUserId)
    return result.changes ? this.get(ownerUserId, id) : null
  }

  saveDocument(ownerUserId: number, id: number, document: SpeakerDocument, status: 'edited' | 'corrected' = 'edited') {
    const corrected = document.blocks.map(block => `${block.speakerLabel}:\n${block.text}`).join('\n\n')
    const result = this.#database.prepare(`UPDATE transcriptions SET formatted_transcript = ?, speakers = ?, corrected_text = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status != 'processing'`).run(JSON.stringify(document.blocks), JSON.stringify(document.speakers), corrected, status, id, ownerUserId)
    return result.changes ? this.get(ownerUserId, id) : null
  }

  updateStatus(ownerUserId: number, id: number, status: 'completed' | 'error') {
    if (status !== 'completed' && status !== 'error') throw new Error('Invalid transcription status')
    const result = this.#database.prepare(`UPDATE transcriptions SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status = 'processing'`).run(status, id, ownerUserId)
    return result.changes ? this.get(ownerUserId, id) : null
  }

  saveCorrection(ownerUserId: number, id: number, correctedText: string, status: 'edited' | 'corrected' = 'edited') {
    const result = this.#database.prepare(`UPDATE transcriptions SET corrected_text = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status != 'processing'`).run(correctedText, status, id, ownerUserId)
    return result.changes ? this.get(ownerUserId, id) : null
  }

  deleteTranscription(ownerUserId: number, id: number) {
    return this.#database.prepare('DELETE FROM transcriptions WHERE id = ? AND owner_user_id = ?').run(id, ownerUserId).changes > 0
  }

  listTranscriptionIds(ownerUserId: number) {
    return (this.#database.prepare('SELECT id FROM transcriptions WHERE owner_user_id = ?').all(ownerUserId) as Array<{ id: number }>).map(row => row.id)
  }

  createAnalysis(ownerUserId: number, preset: AnalysisPreset, model: string, transcriptionIds: number[], sourceNames: string[]) {
    const result = this.#database.prepare('INSERT INTO analysis_runs (owner_user_id, preset, model, transcription_ids, source_names) VALUES (?, ?, ?, ?, ?)').run(ownerUserId, preset, model, JSON.stringify(transcriptionIds), JSON.stringify(sourceNames))
    return this.getAnalysis(ownerUserId, Number(result.lastInsertRowid))!
  }

  getAnalysis(ownerUserId: number, id: number) {
    const row = this.#database.prepare('SELECT * FROM analysis_runs WHERE id = ? AND owner_user_id = ?').get(id, ownerUserId) as AnalysisRow | undefined
    return row ? serializeAnalysis(row) : null
  }

  listAnalyses(ownerUserId: number, limit: number, offset: number) {
    const rows = this.#database.prepare('SELECT * FROM analysis_runs WHERE owner_user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').all(ownerUserId, limit, offset) as AnalysisRow[]
    const count = this.#database.prepare('SELECT COUNT(*) AS count FROM analysis_runs WHERE owner_user_id = ?').get(ownerUserId) as { count: number }
    return { data: rows.map(serializeAnalysis), total: count.count }
  }

  countActiveAnalyses(ownerUserId?: number) {
    const row = ownerUserId === undefined
      ? this.#database.prepare("SELECT COUNT(*) AS count FROM analysis_runs WHERE status IN ('pending', 'running')").get()
      : this.#database.prepare("SELECT COUNT(*) AS count FROM analysis_runs WHERE owner_user_id = ? AND status IN ('pending', 'running')").get(ownerUserId)
    return (row as { count: number }).count
  }

  startAnalysis(ownerUserId: number, id: number) {
    const result = this.#database.prepare("UPDATE analysis_runs SET status = 'running', progress_phase = 'preparing', error_message = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status = 'pending'").run(id, ownerUserId)
    return result.changes ? this.getAnalysis(ownerUserId, id) : null
  }

  setAnalysisProgress(ownerUserId: number, id: number, phase: Extract<AnalysisProgressPhase, 'preparing' | 'generating' | 'validating'>) {
    const updated = this.#database.prepare("UPDATE analysis_runs SET progress_phase = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status = 'running'").run(phase, id, ownerUserId)
    return updated.changes ? this.getAnalysis(ownerUserId, id) : null
  }

  completeAnalysis(ownerUserId: number, id: number, result: AnalysisResult) {
    const resultJson = JSON.stringify(analysisResultFromUnknown(result))
    const updated = this.#database.prepare("UPDATE analysis_runs SET result_json = ?, status = 'completed', progress_phase = 'completed', error_message = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status = 'running'").run(resultJson, id, ownerUserId)
    return updated.changes ? this.getAnalysis(ownerUserId, id) : null
  }

  failAnalysis(ownerUserId: number, id: number, message: string) {
    const updated = this.#database.prepare("UPDATE analysis_runs SET status = 'error', progress_phase = 'failed', error_message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND owner_user_id = ? AND status IN ('pending', 'running')").run(message.slice(0, 500), id, ownerUserId)
    return updated.changes ? this.getAnalysis(ownerUserId, id) : null
  }

  deleteAnalysis(ownerUserId: number, id: number) {
    return this.#database.prepare('DELETE FROM analysis_runs WHERE id = ? AND owner_user_id = ?').run(id, ownerUserId).changes > 0
  }

  findUserCredential(username: string) {
    const row = this.#database.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserRow | undefined
    return row ? { user: serializeUser(row), credential: { hash: row.password_hash, salt: row.password_salt } } : null
  }

  getUser(id: number) {
    const row = this.#database.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? serializeUser(row) : null
  }

  updateDiarizationMode(id: number, mode: DiarizationMode) {
    const result = this.#database.prepare("UPDATE users SET diarization_mode = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(mode, id)
    return result.changes ? this.getUser(id) : null
  }

  listUsers(limit: number, offset: number) {
    const rows = this.#database.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').all(limit, offset) as UserRow[]
    const total = (this.#database.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count
    return { data: rows.map(serializeUser), total }
  }

  createUser(username: string, displayName: string, role: UserRole, credential: PasswordCredential) {
    const result = this.#database.prepare('INSERT INTO users (username, display_name, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)').run(username, displayName, role, credential.hash, credential.salt)
    return this.getUser(Number(result.lastInsertRowid))!
  }

  updateUser(id: number, input: { displayName?: string; role?: UserRole; enabled?: boolean; credential?: PasswordCredential }) {
    const current = this.getUser(id)
    if (!current) return null
    const nextRole = input.role ?? current.role
    const nextEnabled = input.enabled ?? current.enabled
    if (current.role === 'admin' && current.enabled && (nextRole !== 'admin' || !nextEnabled)) {
      const enabledAdmins = (this.#database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND enabled = 1").get() as { count: number }).count
      if (enabledAdmins <= 1) throw new Error('last-enabled-admin')
    }
    const credential = input.credential ?? this.findUserCredential(current.username)!.credential
    this.#database.prepare("UPDATE users SET display_name = ?, role = ?, enabled = ?, password_hash = ?, password_salt = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(input.displayName ?? current.displayName, nextRole, nextEnabled ? 1 : 0, credential.hash, credential.salt, id)
    if (!nextEnabled || input.credential) this.revokeUserSessions(id)
    return this.getUser(id)
  }

  deleteUser(id: number, actorUserId: number) {
    if (id === actorUserId) throw new Error('cannot-delete-self')
    const current = this.getUser(id)
    if (!current) return false
    if (current.role === 'admin' && current.enabled) {
      const enabledAdmins = (this.#database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND enabled = 1").get() as { count: number }).count
      if (enabledAdmins <= 1) throw new Error('last-enabled-admin')
    }
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database.prepare('DELETE FROM transcriptions WHERE owner_user_id = ?').run(id)
      const deleted = this.#database.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0
      this.#database.exec('COMMIT')
      return deleted
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  createSession(idHash: string, userId: number, expiresAt: string) {
    this.#database.prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)').run(idHash, userId, expiresAt)
  }

  getSession(idHash: string, now = new Date().toISOString()) {
    const row = this.#database.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id_hash = ? AND sessions.expires_at > ? AND users.enabled = 1').get(idHash, now) as UserRow | undefined
    return row ? serializeUser(row) : null
  }

  revokeSession(idHash: string) { this.#database.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash) }
  revokeUserSessions(userId: number) { this.#database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId) }
  purgeExpiredSessions(now = new Date().toISOString()) { this.#database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now) }

  close() { this.#database.close() }
}
