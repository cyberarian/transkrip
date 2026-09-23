import { describe, expect, it } from 'vitest'
import { audioReadyMessage } from './transcription-readiness'

describe('audio readiness guidance', () => {
  it('asks for a model when audio is prepared without one', () => {
    expect(audioReadyMessage('missing', false)).toContain('Siapkan model')
    expect(audioReadyMessage('missing', false)).not.toContain('Tekan Transkripsikan')
  })
  it('waits for an in-flight model load', () => {
    expect(audioReadyMessage('loading', false)).toContain('Tunggu')
  })
  it('requires model recovery after an engine error', () => {
    expect(audioReadyMessage('error', false)).toContain('muat ulang model')
  })
  it('offers the matching action only once the model is ready', () => {
    expect(audioReadyMessage('ready', false)).toContain('Tekan Transkripsikan')
    expect(audioReadyMessage('ready', true)).toContain('Lanjutkan transkripsi')
  })
})
