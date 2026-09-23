export const ANALYSIS_PRESETS = [
  {
    id: 'meeting_minutes',
    title: 'Notulen rapat',
    description: 'Susun ringkasan, keputusan, tindak lanjut, dan pertanyaan yang belum terjawab.',
    sections: ['Keputusan', 'Tindak lanjut', 'Pertanyaan terbuka'],
  },
  {
    id: 'action_items',
    title: 'Tindakan lanjutan',
    description: 'Pisahkan pekerjaan, pemilik, tenggat, ketergantungan, dan langkah berikutnya.',
    sections: ['Tindakan', 'Ketergantungan', 'Langkah berikutnya'],
  },
  {
    id: 'cross_transcript_themes',
    title: 'Tema lintas transkrip',
    description: 'Bandingkan beberapa percakapan untuk menemukan pola, kesepakatan, dan perbedaan.',
    sections: ['Tema berulang', 'Kesepakatan', 'Perbedaan'],
  },
] as const

export type AnalysisPreset = typeof ANALYSIS_PRESETS[number]['id']
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'error'
export type AnalysisProgressPhase = 'queued' | 'preparing' | 'generating' | 'validating' | 'completed' | 'failed'
export type AnalysisEvidence = {
  ref: string; transcriptionId: number; source: string; blockId: string | null
  start: number | null; end: number | null; quote: string; sourceUpdatedAt: string
}
export type AnalysisResult = { summary: string; primary: string; secondary: string; tertiary: string; evidence?: AnalysisEvidence[] }

export type AnalysisRun = {
  id: number
  preset: AnalysisPreset
  model: string
  transcriptionIds: number[]
  sourceNames: string[]
  result: AnalysisResult | null
  status: AnalysisStatus
  progressPhase: AnalysisProgressPhase
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export function isAnalysisPreset(value: unknown): value is AnalysisPreset {
  return ANALYSIS_PRESETS.some(preset => preset.id === value)
}

export function analysisResultFromUnknown(value: unknown): AnalysisResult {
  if (!value || typeof value !== 'object') throw new Error('Hasil analisis tidak valid.')
  const candidate = value as Record<string, unknown>
  const keys = ['summary', 'primary', 'secondary', 'tertiary'] as const
  if (keys.some(key => typeof candidate[key] !== 'string' || (candidate[key] as string).length > 100_000)) throw new Error('Hasil analisis tidak valid.')
  const result: AnalysisResult = { summary: (candidate.summary as string).trim(), primary: (candidate.primary as string).trim(), secondary: (candidate.secondary as string).trim(), tertiary: (candidate.tertiary as string).trim() }
  if (!result.summary) throw new Error('Hasil analisis tidak valid.')
  if (candidate.evidence !== undefined) {
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length > 64) throw new Error('Bukti analisis tidak valid.')
    const seen = new Set<string>()
    result.evidence = candidate.evidence.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new Error('Bukti analisis tidak valid.')
      const e = item as AnalysisEvidence
      if (!Number.isSafeInteger(e.transcriptionId) || e.transcriptionId < 1 || typeof e.ref !== 'string' || !new RegExp(`^T${e.transcriptionId}P[1-9][0-9]*$`).test(e.ref) || seen.has(e.ref)
        || typeof e.source !== 'string' || !e.source || e.source.length > 512 || (e.blockId !== null && (typeof e.blockId !== 'string' || e.blockId.length > 200))
        || typeof e.quote !== 'string' || !e.quote.trim() || e.quote.length > 2000 || typeof e.sourceUpdatedAt !== 'string' || e.sourceUpdatedAt.length > 100
        || !((e.start === null && e.end === null) || (typeof e.start === 'number' && Number.isFinite(e.start) && e.start >= 0 && typeof e.end === 'number' && Number.isFinite(e.end) && e.end >= e.start))) throw new Error('Bukti analisis tidak valid.')
      seen.add(e.ref)
      return { ref: e.ref, transcriptionId: e.transcriptionId, source: e.source, blockId: e.blockId, start: e.start, end: e.end, quote: e.quote, sourceUpdatedAt: e.sourceUpdatedAt }
    })
  }
  return result
}

export function analysisRunFromUnknown(value: unknown): AnalysisRun {
  if (!value || typeof value !== 'object') throw new Error('Data analisis tidak valid.')
  const item = value as Record<string, unknown>
  const statuses = new Set<AnalysisStatus>(['pending', 'running', 'completed', 'error'])
  const phases = new Set<AnalysisProgressPhase>(['queued', 'preparing', 'generating', 'validating', 'completed', 'failed'])
  if (!Number.isSafeInteger(item.id) || (item.id as number) < 1 || !isAnalysisPreset(item.preset) || typeof item.model !== 'string' || item.model.length < 1 || item.model.length > 200 || !statuses.has(item.status as AnalysisStatus)) throw new Error('Data analisis tidak valid.')
  if (!phases.has(item.progressPhase as AnalysisProgressPhase)) throw new Error('Fase analisis tidak valid.')
  if (!Array.isArray(item.transcriptionIds) || item.transcriptionIds.length > 8 || !item.transcriptionIds.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Data analisis tidak valid.')
  if (!Array.isArray(item.sourceNames) || item.sourceNames.length !== item.transcriptionIds.length || !item.sourceNames.every(name => typeof name === 'string' && name.length > 0 && name.length <= 512)) throw new Error('Data analisis tidak valid.')
  if ((item.result !== null && item.result !== undefined) || item.status === 'completed') item.result = analysisResultFromUnknown(item.result)
  else item.result = null
  if (item.errorMessage !== null && typeof item.errorMessage !== 'string') throw new Error('Data analisis tidak valid.')
  if (typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') throw new Error('Data analisis tidak valid.')
  if (item.result && (item.result as AnalysisResult).evidence?.some(e => !(item.transcriptionIds as number[]).includes(e.transcriptionId))) throw new Error('Sumber bukti analisis tidak valid.')
  return item as unknown as AnalysisRun
}

export function analysisPreset(id: AnalysisPreset) {
  return ANALYSIS_PRESETS.find(preset => preset.id === id)!
}

export function formatAnalysisElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(milliseconds) ? milliseconds / 1_000 : 0))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function analysisActivity(run: AnalysisRun, now = Date.now()) {
  const startedAt = Date.parse(run.status === 'pending' ? run.createdAt : run.updatedAt)
  const elapsedMs = Math.max(0, now - (Number.isFinite(startedAt) ? startedAt : now))
  const elapsed = formatAnalysisElapsed(elapsedMs)
  if (run.status === 'pending' || run.progressPhase === 'queued') return {
    phase: 'Menunggu antrean lokal', elapsed,
    detail: 'Pekerjaan tersimpan di SQLite dan akan dimulai setelah analisis sebelumnya selesai.',
  }
  if (run.progressPhase === 'preparing') return {
    phase: 'Menyiapkan pipeline lokal', elapsed,
    detail: 'DocETL sedang membaca bukti terpilih dan menyiapkan permintaan terstruktur.',
  }
  if (run.progressPhase === 'generating') return {
    phase: 'Ollama sedang menyusun hasil', elapsed,
    detail: 'Model lokal sedang menulis hasil terstruktur dari bukti transkrip.',
  }
  return {
    phase: 'Memvalidasi hasil lokal', elapsed,
    detail: 'Respons DocETL sudah diterima dan sedang diperiksa sebelum disimpan ke SQLite.',
  }
}
