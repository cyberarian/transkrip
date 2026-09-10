import { describe, expect, it, vi } from 'vitest'
import { CheckpointWriter, parseWorkspaceCheckpoint } from './workspace-checkpoint'

export const checkpoint = { version: 1, audioFile: 'rapat.wav', audioHash: null, duration: 60, position: 12, language: 'id', modelName: 'ggml-base.bin', selectedId: 's1', taskId: null, segments: [{ id: 's1', start: 0, end: 10, text: 'Teks tersimpan', language: 'id' }], resume: null }

describe('durable workspace checkpoints', () => {
  it('validates persisted text and rejects audio bytes, invalid times, and mismatched checkpoints', () => {
    expect(parseWorkspaceCheckpoint(checkpoint)).toEqual(checkpoint)
    expect(() => parseWorkspaceCheckpoint({ ...checkpoint, audio: [1, 2] })).toThrow()
    expect(() => parseWorkspaceCheckpoint({ ...checkpoint, position: Infinity })).toThrow()
    expect(() => parseWorkspaceCheckpoint({ ...checkpoint, resume: { nextSample: 500, segmentCount: 5, chunkSeconds: 30 } })).toThrow()
  })
  it('coalesces a typing burst into one durable write', async () => {
    const save = vi.fn().mockResolvedValue({ revision: 1 })
    const writer = new CheckpointWriter(0, save)
    for (let i = 0; i < 100; i++) writer.stage({ ...checkpoint, position: i % 60 } as never)
    await writer.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][0].checkpoint.position).toBe(39)
    expect(writer.dirty).toBe(false)
    writer.dispose()
  })
  it('retries the identical operation after a lost response before saving newer edits', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({ revision: 1 }).mockResolvedValueOnce({ revision: 2 })
    const writer = new CheckpointWriter(0, save)
    writer.stage(checkpoint as never)
    await expect(writer.flush()).rejects.toThrow('connection lost')
    writer.stage({ ...checkpoint, position: 20 } as never)
    await writer.flush()
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0])
    expect(save.mock.calls[2][0].revision).toBe(1)
    expect(save.mock.calls[2][0].checkpoint.position).toBe(20)
    writer.dispose()
  })
  it('does not drop newer edits while a save is in flight', async () => {
    let finish!: (value: { revision: number }) => void
    const save = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ revision: 2 })
    const writer = new CheckpointWriter(0, save)
    writer.stage(checkpoint as never)
    const pending = writer.flush()
    writer.stage({ ...checkpoint, position: 30 } as never)
    finish({ revision: 1 })
    await pending
    expect(save).toHaveBeenCalledTimes(2)
    expect(writer.dirty).toBe(false)
    writer.dispose()
  })
})
