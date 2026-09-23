import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const hook = readFileSync(new URL('./use-workspace-checkpoint.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const audioModule = readFileSync(new URL('./audio.ts', import.meta.url), 'utf8')

describe('manual workspace save', () => {
  it('wires the Simpan sekarang button to the manual save plan', () => {
    expect(app).toContain('onClick={planManualSave}>Simpan sekarang</button>')
    expect(app).not.toContain('retrySave')
    expect(hook).toContain('planManualSave')
  })

  it('re-arms from a checkpoint conflict instead of throwing forever', () => {
    expect(hook).toContain('if (!ready || blocked.current) { setRetry(value => value + 1); return }')
  })

  it('re-arming a conflicted workspace never clobbers unsaved local text with the server copy', () => {
    expect(hook).toContain('if (!rearm && data.checkpoint) restore(parseWorkspaceCheckpoint(data.checkpoint))')
  })

  it('re-arming stages the latest local checkpoint so pending edits are saved after recovery', () => {
    expect(hook).toContain('writer.current.stage(latestCheckpoint.current)')
  })
})

describe('loading large audio recordings', () => {
  it('warns before reading recordings over the hint threshold', () => {
    expect(audioModule).toContain('export const LARGE_AUDIO_HINT_BYTES')
    expect(app).toContain('file.size > LARGE_AUDIO_HINT_BYTES')
    expect(app).toContain('Menyiapkannya membutuhkan memori dan waktu di perangkat ini')
  })

  it('reads the recording once with visible progress before hashing and decoding', () => {
    expect(app).toContain('await readAudioBytes(file, percent => setAudioProgress(percent), controller.signal)')
    const loadAudio = app.slice(app.indexOf('const loadAudio'), app.indexOf('const discardRestoredWorkspace'))
    expect(loadAudio).not.toContain('file.arrayBuffer()')
    expect(app).toContain('className="audio-progress"')
  })

  it('reports a memory-specific failure for large recordings instead of a format error', () => {
    expect(app).toContain('file.size > LARGE_AUDIO_HINT_BYTES')
    expect(app).toContain('Memori lokal tidak cukup')
  })

  it('reuses hashed bytes for decoding without unsupported media-element rendering', () => {
    expect(app).toContain('await decodeAudio(bytes!, controller.signal)')
    expect(audioModule).not.toContain('createMediaElementSource')
  })

})

describe('loading different audio after a restored workspace', () => {
  it('asks before discarding restored text instead of silently rejecting the file', () => {
    expect(app).toContain('window.confirm')
    expect(app).toContain('Audio ini berbeda dari rekaman pada ruang kerja yang dipulihkan')
  })

  it('retains restored text until the new recording has decoded successfully', () => {
    const loadAudio = app.slice(app.indexOf('const loadAudio'), app.indexOf('const discardRestoredWorkspace'))
    expect(loadAudio.indexOf('setRestored(false)')).toBeGreaterThan(loadAudio.indexOf('await decodeAudio('))
  })

  it('offers an explicit fresh-workspace escape hatch in the checkpoint bar', () => {
    expect(app).toContain('discardRestoredWorkspace')
    expect(app).toContain('Ruang kerja baru</button>')
  })

  it('the fresh-workspace reset clears task identity, segments, and restored audio state', () => {
    const fn = app.slice(app.indexOf('const discardRestoredWorkspace'), app.indexOf('const togglePlay'))
    expect(fn).toContain('setRestored(false)')
    expect(fn).toContain('taskIdRef.current = null')
    expect(fn).toContain('setSegments([])')
    expect(fn).toContain('setResumeState(null)')
    expect(fn).toContain('setAudioUrl(null)')
  })
})
