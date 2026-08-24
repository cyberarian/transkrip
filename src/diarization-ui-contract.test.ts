import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const settings = readFileSync(new URL('./components/DiarizationSettings.tsx', import.meta.url), 'utf8')
const settingsPage = readFileSync(new URL('./components/SettingsPage.tsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

describe('diarization interface contract', () => {
  it('offers explicit Auto, Required, and Off radio choices with textual state', () => {
    expect(settings).toContain('<fieldset')
    expect(settings).toContain('type="radio"')
    expect(settings).toContain("mode: 'auto'")
    expect(settings).toContain("mode: 'required'")
    expect(settings).toContain("mode: 'off'")
    expect(settings).toContain("name: 'Required'")
    expect(settings).toContain("name: 'Off'")
    expect(workspace).toContain('<option value="required">Required</option>')
    expect(workspace).toContain('<option value="off">Off</option>')
    expect(settingsPage).toContain("savedDiarizationMode === 'required' ? 'Required' : 'Off'")
    expect(`${settings}\n${settingsPage}\n${workspace}`).not.toMatch(/Wajib|Mati/)
    expect(settings).toContain('Direkomendasikan')
  })

  it('provides a visible per-transcription override and checks readiness before encoding WAV', () => {
    expect(workspace).toContain('aria-label="Mode diarization untuk transkripsi ini"')
    expect(workspace.indexOf('prepareDiarization(')).toBeLessThan(workspace.indexOf('encodePcm16Wav(pcm)'))
  })
})
