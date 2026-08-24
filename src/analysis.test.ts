import { describe, expect, it } from 'vitest'
import { ANALYSIS_PRESETS, analysisActivity, analysisResultFromUnknown, formatAnalysisElapsed, isAnalysisPreset, type AnalysisRun } from './analysis'

const running: AnalysisRun = {
  id: 7,
  preset: 'meeting_minutes',
  model: 'local/model:q4',
  transcriptionIds: [1],
  sourceNames: ['rapat.wav'],
  result: null,
  status: 'running',
  progressPhase: 'generating',
  errorMessage: null,
  createdAt: '2026-08-17T00:00:00.000Z',
  updatedAt: '2026-08-17T00:00:05.000Z',
}

describe('analysis contract', () => {
  it('exposes three bounded, predefined pipelines', () => {
    expect(ANALYSIS_PRESETS.map(preset => preset.id)).toEqual(['meeting_minutes', 'action_items', 'cross_transcript_themes'])
    expect(ANALYSIS_PRESETS.every(preset => preset.title && preset.description && preset.sections.length === 3)).toBe(true)
  })

  it('accepts only supported pipeline identifiers', () => {
    expect(isAnalysisPreset('meeting_minutes')).toBe(true)
    expect(isAnalysisPreset('custom_prompt')).toBe(false)
  })

  it('validates and trims untrusted worker output', () => {
    expect(analysisResultFromUnknown({ summary: ' Ringkasan ', primary: ' Keputusan ', secondary: ' Tindakan ', tertiary: ' Pertanyaan ' })).toEqual({
      summary: 'Ringkasan', primary: 'Keputusan', secondary: 'Tindakan', tertiary: 'Pertanyaan',
    })
    expect(() => analysisResultFromUnknown({ summary: 'ok', primary: [], secondary: '', tertiary: '' })).toThrow(/tidak valid/i)
  })

  it('reports honest elapsed activity without inventing a percentage', () => {
    expect(formatAnalysisElapsed(5_000)).toBe('00:05')
    expect(formatAnalysisElapsed(125_000)).toBe('02:05')
    expect(analysisActivity(running, Date.parse('2026-08-17T00:00:12.000Z'))).toEqual({
      phase: 'Ollama sedang menyusun hasil',
      elapsed: '00:07',
      detail: 'Model lokal sedang menulis hasil terstruktur dari bukti transkrip.',
    })
    expect(analysisActivity({ ...running, progressPhase: 'preparing' }, Date.parse('2026-08-17T00:00:40.000Z')).phase).toBe('Menyiapkan pipeline lokal')
    expect(analysisActivity({ ...running, progressPhase: 'validating' }, Date.parse('2026-08-17T00:02:00.000Z')).phase).toBe('Memvalidasi hasil lokal')
    expect(analysisActivity({ ...running, status: 'pending' }, Date.parse('2026-08-17T00:00:12.000Z')).phase).toBe('Menunggu antrean lokal')
  })
})
