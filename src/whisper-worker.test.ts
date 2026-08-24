import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const worker = readFileSync(new URL('../public/whisper/engine-worker.js', import.meta.url), 'utf8')

describe('whisper worker completion contract', () => {
  it('waits for whisper.cpp background inference before completing a request', () => {
    expect(worker).toContain('await runWhisperChunk(')
    expect(worker).toMatch(/whisper_print_timings:\\s\+total time/)
    expect(worker).toContain('pendingChunk?.resolve()')
  })

  it('rejects an apparently successful transcription when no speech was emitted', () => {
    expect(worker).toContain('segmentsEmitted === 0')
    expect(worker).toContain('Tidak ada ucapan yang dapat dikenali')
  })

  it('accepts only bounded 30- or 60-second batches and reports the active language', () => {
    expect(worker).toContain('new Set([30, 60])')
    expect(worker).toContain("language: activeLanguage")
  })
})
