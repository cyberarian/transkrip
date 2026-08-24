import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CORRECTION_MODEL,
  getCorrectionModel,
  isValidOllamaModelName,
  saveCorrectionModel,
} from './correction-model'

function memoryStorage(initial?: string) {
  let value = initial ?? null
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
  }
}

describe('correction model preference', () => {
  it('recommends the requested Sahabat-AI quantization by default', () => {
    expect(DEFAULT_CORRECTION_MODEL).toBe('csalab/sahabatai1:llama3_base_Q4_K_M')
  })

  it('uses the pinned correction model when no valid preference exists', () => {
    expect(getCorrectionModel(memoryStorage())).toBe(DEFAULT_CORRECTION_MODEL)
    expect(getCorrectionModel(memoryStorage('bad model\nname'))).toBe(DEFAULT_CORRECTION_MODEL)
  })

  it('migrates the former Garuda default without replacing an explicit custom choice', () => {
    expect(getCorrectionModel(memoryStorage('transkrip-garuda:66a27b863a7e'))).toBe(DEFAULT_CORRECTION_MODEL)
    expect(getCorrectionModel(memoryStorage('qwen3:8b'))).toBe('qwen3:8b')
  })

  it('stores and restores a valid installed-model name', () => {
    const storage = memoryStorage()
    saveCorrectionModel('qwen3:8b', storage)
    expect(getCorrectionModel(storage)).toBe('qwen3:8b')
  })

  it('rejects names that could smuggle control characters or oversized values', () => {
    expect(isValidOllamaModelName('team/model.name:Q4_K_M')).toBe(true)
    expect(isValidOllamaModelName('model name')).toBe(false)
    expect(isValidOllamaModelName(`model\nname`)).toBe(false)
    expect(isValidOllamaModelName('a'.repeat(201))).toBe(false)
  })
})
