import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { AudioStaging, diarize } from './diarization.ts'

test('purges orphaned staged audio at startup', () => {
  const directory = mkdtempSync(join(tmpdir(), 'transkrip-staging-'))
  writeFileSync(join(directory, '42.wav'), Buffer.alloc(44))
  new AudioStaging(directory)
  assert.equal(existsSync(join(directory, '42.wav')), false)
})

test('removes staged audio when local diarization fails', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'transkrip-staging-'))
  const staging = new AudioStaging(directory)
  const wav = Buffer.alloc(44); wav.write('RIFF', 0); wav.write('WAVE', 8); staging.write(7, wav)
  const fetcher = async () => { throw new Error('sidecar unavailable') }
  const result = await diarize(staging, 7, [{ id: 's', start: 0, end: 1, text: 'Halo.', language: 'id' }], 'id', fetcher as typeof fetch)
  assert.equal(result.mode, 'fallback')
  assert.equal(existsSync(staging.path(7)), false)
})
