import { describe, expect, it } from 'vitest'
import { DEFAULT_CORRECTION_MODEL } from './correction-model'
import { getAnalysisModel, saveAnalysisModel } from './analysis-model'

describe('analysis model preference', () => {
  it('defaults to the recommended local model and ignores invalid saved values', () => {
    expect(getAnalysisModel({ getItem: () => null })).toBe(DEFAULT_CORRECTION_MODEL)
    expect(getAnalysisModel({ getItem: () => 'bad model;curl' })).toBe(DEFAULT_CORRECTION_MODEL)
  })

  it('stores only a validated Ollama model alias', () => {
    let saved = ''
    saveAnalysisModel('local/model:q4', { setItem: (_key, value) => { saved = value } })
    expect(saved).toBe('local/model:q4')
    expect(() => saveAnalysisModel('bad model', { setItem: () => undefined })).toThrow(/tidak valid/i)
  })
})
