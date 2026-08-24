import { describe, expect, it } from 'vitest'
import { decideDiarization, isDiarizationMode, prepareDiarization } from './diarization-mode'

describe('diarization mode', () => {
  it('accepts only the three public mode values', () => {
    expect(['auto', 'required', 'off'].map(isDiarizationMode)).toEqual([true, true, true])
    expect(isDiarizationMode('always')).toBe(false)
    expect(isDiarizationMode(null)).toBe(false)
  })

  it('never probes or uploads audio when mode is off', () => {
    expect(decideDiarization('off', 'unavailable')).toEqual({ canStart: true, shouldUpload: false })
  })

  it('continues Auto without audio but blocks Required when the sidecar is unavailable', () => {
    expect(decideDiarization('auto', 'unavailable')).toEqual({ canStart: true, shouldUpload: false })
    expect(decideDiarization('required', 'unavailable')).toEqual({ canStart: false, shouldUpload: false })
  })

  it('uploads local audio for Auto and Required only after readiness succeeds', () => {
    expect(decideDiarization('auto', 'ready')).toEqual({ canStart: true, shouldUpload: true })
    expect(decideDiarization('required', 'ready')).toEqual({ canStart: true, shouldUpload: true })
  })

  it('does not call the readiness endpoint in Off mode', async () => {
    let calls = 0
    const decision = await prepareDiarization('off', async () => { calls += 1; return 'ready' })
    expect(calls).toBe(0)
    expect(decision).toEqual({ canStart: true, shouldUpload: false })
  })

  it('fails safely when the readiness request itself fails', async () => {
    const unavailable = async () => { throw new Error('local service unavailable') }
    await expect(prepareDiarization('auto', unavailable)).resolves.toEqual({ canStart: true, shouldUpload: false })
    await expect(prepareDiarization('required', unavailable)).resolves.toEqual({ canStart: false, shouldUpload: false })
  })
})
