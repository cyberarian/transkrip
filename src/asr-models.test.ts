import { describe, expect, it } from 'vitest'
import { assessModelMemory, getAsrModel } from './asr-models'

describe('ASR model requirements', () => {
  it('publishes model-specific memory requirements', () => {
    expect(getAsrModel('ggml-base.bin').minimumMemoryGb).toBe(4)
    expect(getAsrModel('ggml-small-q5_1.bin').minimumMemoryGb).toBe(6)
    expect(getAsrModel('cahya-ggml-medium-q5_0.bin')).toMatchObject({ minimumMemoryGb: 8, recommendedMemoryGb: 16 })
  })

  it('blocks only when a browser-reported memory value is below the model minimum', () => {
    expect(assessModelMemory('cahya-ggml-medium-q5_0.bin', 4).level).toBe('blocked')
    expect(assessModelMemory('cahya-ggml-medium-q5_0.bin', 8).level).toBe('supported')
  })

  it('does not reject platforms whose browser does not expose device memory', () => {
    expect(assessModelMemory('cahya-ggml-medium-q5_0.bin', undefined).level).toBe('unknown')
  })
})
