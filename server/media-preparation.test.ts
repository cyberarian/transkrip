import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { MediaPreparation } from './media-preparation.ts'

function wav(seconds = 1) {
  const bytes = Buffer.alloc(44 + seconds * 48000 * 2)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(48000, 24); bytes.writeUInt32LE(96000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40)
  for (let i = 44; i < bytes.length; i += 2) bytes.writeInt16LE(Math.round(Math.sin(i) * 12000), i)
  return bytes
}

test('local preparation streams, hashes, resamples, and removes temporary media', async () => {
  const root = await mkdtemp(join(tmpdir(), 'transkrip-media-test-'))
  try {
    const service = new MediaPreparation(root)
    const bytes = wav()
    const prepared = await service.prepare(Readable.from([bytes]), bytes.length, new AbortController().signal)
    assert.equal(prepared.hash, createHash('sha256').update(bytes).digest('hex'))
    assert.equal(prepared.duration, 1)
    assert.equal((await readFile(prepared.path)).length, 16000 * 4)
    await prepared.dispose()
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('rejects oversize, incomplete, corrupt, and cancelled inputs without retaining files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'transkrip-media-test-'))
  try {
    const service = new MediaPreparation(root)
    await assert.rejects(service.prepare(Readable.from([]), 2 * 1024 ** 3 + 1, new AbortController().signal), /2 GB/)
    await assert.rejects(service.prepare(Readable.from([Buffer.from('x')]), 2, new AbortController().signal), /lengkap/)
    await assert.rejects(service.prepare(Readable.from([Buffer.from('bad')]), 3, new AbortController().signal), /codec|audio/i)
    const controller = new AbortController(); controller.abort()
    await assert.rejects(service.prepare(Readable.from([wav()]), wav().length, controller.signal), { name: 'AbortError' })
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('missing FFmpeg and cancelled uploads release the single-job slot and clean up', async () => {
  const root = await mkdtemp(join(tmpdir(), 'transkrip-media-test-'))
  try {
    const missing = new MediaPreparation(root, join(root, 'missing-ffmpeg'))
    const bytes = wav()
    await assert.rejects(missing.prepare(Readable.from([bytes]), bytes.length, new AbortController().signal), /FFmpeg/)
    assert.deepEqual(await readdir(root), [])
    const service = new MediaPreparation(root)
    const controller = new AbortController()
    const pending = new Readable({ read() { controller.abort() } })
    await assert.rejects(service.prepare(pending, 1000, controller.signal), { name: 'AbortError' })
    const prepared = await service.prepare(Readable.from([bytes]), bytes.length, new AbortController().signal)
    await prepared.dispose()
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('keeps the slot until disposal and ignores repeated disposal of an older job', async () => {
  const root = await mkdtemp(join(tmpdir(), 'transkrip-media-test-'))
  try {
    const service = new MediaPreparation(root)
    const bytes = wav()
    const prepare = () => service.prepare(Readable.from([bytes]), bytes.length, new AbortController().signal)
    const first = await prepare()
    await assert.rejects(prepare(), /sedang berjalan/)
    await first.dispose()
    const second = await prepare()
    await first.dispose()
    await assert.rejects(prepare(), /sedang berjalan/)
    await second.dispose()
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})
