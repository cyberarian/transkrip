import type { Segment } from './types'

export type WorkspaceCheckpoint = {
  version: 1
  audioFile: string
  audioHash: string | null
  duration: number
  position: number
  language: string
  modelName: string
  selectedId: string | null
  taskId: number | null
  segments: Segment[]
  diarizationMode?: 'auto' | 'off' | 'required'
  resume: { nextSample: number; segmentCount: number; chunkSeconds: number } | null
}

export function parseWorkspaceCheckpoint(value: unknown): WorkspaceCheckpoint {
  const invalid = () => { throw new Error('Checkpoint ruang kerja tidak valid.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const v = value as WorkspaceCheckpoint
  const keys = ['version', 'audioFile', 'audioHash', 'duration', 'position', 'language', 'modelName', 'selectedId', 'taskId', 'segments', 'resume', 'diarizationMode']
  if (Object.keys(v).some(key => !keys.includes(key)) || v.version !== 1
    || typeof v.audioFile !== 'string' || v.audioFile.length > 512
    || typeof v.modelName !== 'string' || v.modelName.length > 512
    || !['id', 'en', 'auto'].includes(v.language)
    || (v.diarizationMode !== undefined && !['auto', 'off', 'required'].includes(v.diarizationMode))
    || (v.audioHash !== null && (typeof v.audioHash !== 'string' || !/^[a-f0-9]{64}$/.test(v.audioHash)))
    || !Number.isFinite(v.duration) || v.duration < 0 || v.duration > 14400
    || !Number.isFinite(v.position) || v.position < 0 || v.position > v.duration
    || (v.taskId !== null && (!Number.isSafeInteger(v.taskId) || v.taskId <= 0))
    || !Array.isArray(v.segments) || v.segments.length > 20000) return invalid()
  const ids = new Set<string>()
  for (const s of v.segments) {
    if (!s || typeof s.id !== 'string' || !s.id || s.id.length > 100 || ids.has(s.id)
      || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < 0 || s.end < s.start || s.end > 14460
      || (s.confidence !== undefined && (!Number.isFinite(s.confidence) || s.confidence < 0 || s.confidence > 1))
      || typeof s.text !== 'string' || s.text.length > 10000 || !['id', 'en', 'auto'].includes(s.language)
      || Object.keys(s).some(key => !['id', 'start', 'end', 'text', 'language', 'confidence'].includes(key))) return invalid()
    ids.add(s.id)
  }
  if (v.selectedId !== null && (typeof v.selectedId !== 'string' || !ids.has(v.selectedId))) return invalid()
  if (v.resume !== null) {
    const r = v.resume
    if (!r || !Number.isSafeInteger(r.nextSample) || r.nextSample < 0 || r.nextSample > Math.ceil(v.duration * 16000)
      || !Number.isSafeInteger(r.segmentCount) || r.segmentCount < 0 || r.segmentCount > v.segments.length
      || ![30, 60].includes(r.chunkSeconds) || Object.keys(r).some(key => !['nextSample', 'segmentCount', 'chunkSeconds'].includes(key))) return invalid()
  }
  if (new TextEncoder().encode(JSON.stringify(v)).length > 900000) return invalid()
  return v
}

export type CheckpointOperation = { revision: number; operationId: string; checkpoint: WorkspaceCheckpoint }
export class CheckpointWriter {
  private staged: WorkspaceCheckpoint | null = null
  private pending: CheckpointOperation | null = null
  private saving: Promise<void> | null = null
  private disposed = false
  private revision: number
  private save: (operation: CheckpointOperation) => Promise<{ revision: number }>
  constructor(revision: number, save: (operation: CheckpointOperation) => Promise<{ revision: number }>) { this.revision = revision; this.save = save }
  get dirty() { return this.staged !== null || this.pending !== null }
  stage(checkpoint: WorkspaceCheckpoint) { if (!this.disposed) this.staged = checkpoint }
  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.saving) return this.saving
    this.saving = this.drain().finally(() => { this.saving = null })
    return this.saving
  }
  private async drain() {
    while (!this.disposed && this.dirty) {
      if (!this.pending) {
        this.pending = { revision: this.revision, operationId: crypto.randomUUID(), checkpoint: this.staged! }
        this.staged = null
      }
      const result = await this.save(this.pending)
      this.revision = result.revision
      this.pending = null
    }
  }
  dispose() { this.disposed = true; this.staged = null }
}
