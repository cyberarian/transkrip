import { describe, expect, it, vi } from 'vitest'
import { awaitPersistence, createPersistenceRun, enqueueSegment } from './persistence-run'
import type { Segment } from './types'

const segment = { id: 's1', start: 0, end: 1, text: 'Teks pertama.', language: 'id' } satisfies Segment

describe('transcription persistence coordinator', () => {
  it('starts segment writes without waiting for the audio upload', async () => {
    let finishUpload!: () => void
    const audioUpload = new Promise<void>(resolve => { finishUpload = resolve })
    const append = vi.fn().mockResolvedValue(undefined)
    const run = createPersistenceRun(9, audioUpload)

    await enqueueSegment(run, segment, append)
    expect(append).toHaveBeenCalledWith(9, 'Teks pertama.')

    let finalized = false
    const waiting = awaitPersistence(run).then(() => { finalized = true })
    await Promise.resolve()
    expect(finalized).toBe(false)
    finishUpload()
    await waiting
    expect(finalized).toBe(true)
  })

  it('serializes segment writes in arrival order', async () => {
    const order: string[] = []
    const run = createPersistenceRun(9, Promise.resolve())
    const append = async (_id: number, text: string) => { order.push(text) }
    enqueueSegment(run, segment, append)
    enqueueSegment(run, { ...segment, id: 's2', text: 'Teks kedua.' }, append)
    await awaitPersistence(run)
    expect(order).toEqual(['Teks pertama.', 'Teks kedua.'])
  })
})
