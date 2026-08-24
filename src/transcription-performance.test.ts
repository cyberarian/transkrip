import { describe, expect, it } from 'vitest'
import { getTranscriptionProfile } from './transcription-performance'

describe('transcription performance profiles', () => {
  it('tunes Cahya Medium by model cost without assuming an operating system or CPU vendor', () => {
    expect(getTranscriptionProfile('cahya-ggml-medium-q5_0.bin', 12, 'auto', true)).toEqual({
      threads: 6,
      chunkSeconds: 60,
      language: 'id',
      name: 'Cahya Medium seimbang',
    })
  })

  it('keeps multilingual models on shorter responsive batches', () => {
    expect(getTranscriptionProfile('ggml-small-q5_1.bin', 12, 'auto', true)).toEqual({
      threads: 8,
      chunkSeconds: 30,
      language: 'auto',
      name: 'Multilingual seimbang',
    })
  })

  it('uses one thread when cross-origin isolation is unavailable', () => {
    expect(getTranscriptionProfile('cahya-ggml-medium-q5_0.bin', 12, 'id', false).threads).toBe(1)
  })

  it('uses conservative bounds for missing or implausible hardware reports', () => {
    expect(getTranscriptionProfile('ggml-base.bin', 0, 'en', true).threads).toBe(4)
    expect(getTranscriptionProfile('ggml-base.bin', 128, 'en', true).threads).toBe(8)
  })

  it('applies the same result to equivalent logical-core reports on every platform', () => {
    const windows = getTranscriptionProfile('cahya-ggml-medium-q5_0.bin', 12, 'id', true)
    const linux = getTranscriptionProfile('cahya-ggml-medium-q5_0.bin', 12, 'id', true)
    const macos = getTranscriptionProfile('cahya-ggml-medium-q5_0.bin', 12, 'id', true)
    expect(windows).toEqual(linux)
    expect(linux).toEqual(macos)
  })
})
