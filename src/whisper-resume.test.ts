import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../public/whisper/engine-worker.js', import.meta.url), 'utf8')
function fixture() {
  const messages: Record<string, unknown>[] = []
  let receive!: (event: { data: Record<string, unknown> }) => Promise<void>
  const full = vi.fn(() => {
    queueMicrotask(() => {
      context.Module.print('[00:00:01.000 --> 00:00:03.000] Teks baru')
      context.Module.print('whisper_print_timings: total time')
    })
    return 0
  })
  const context = vm.createContext({
    self: { postMessage: (message: Record<string, unknown>) => messages.push(message), addEventListener: (_: string, handler: typeof receive) => { receive = handler } },
    crypto, Float32Array, ArrayBuffer, setTimeout, clearTimeout,
    importScripts: () => { Object.assign(context.Module, { init: () => 1, full_default: full, FS_createDataFile: () => {}, FS_unlink: () => {} }); context.Module.onRuntimeInitialized() },
  })
  vm.runInContext(source, context)
  return { messages, full, receive: (data: Record<string, unknown>) => receive({ data }) }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
describe('resumable worker', () => {
  it('starts at the saved chunk and waits for durable acknowledgement before continuing', async () => {
    const f = fixture()
    await f.receive({ type: 'load-model', requestId: 'model', buffer: new ArrayBuffer(8) })
    const run = f.receive({ type: 'transcribe', requestId: 'run', buffer: new Float32Array(65 * 16000).buffer, language: 'id', threads: 1, chunkSeconds: 30, startSample: 29 * 16000 })
    await tick()
    expect(f.full).toHaveBeenCalledTimes(1)
    expect(f.messages.find(m => m.type === 'segment')).toMatchObject({ segment: { start: 30, end: 32 } })
    expect(f.messages.find(m => m.type === 'checkpoint')).toMatchObject({ nextSample: 58 * 16000 })
    await f.receive({ type: 'checkpoint-saved', requestId: 'wrong-run' })
    expect(f.full).toHaveBeenCalledTimes(1)
    await f.receive({ type: 'checkpoint-saved', requestId: 'run' })
    await tick()
    expect(f.full).toHaveBeenCalledTimes(2)
    await f.receive({ type: 'checkpoint-saved', requestId: 'run' })
    await run
    expect(f.messages.at(-1)).toEqual({ type: 'done', requestId: 'run' })
  })
  it('stops at an unsaved checkpoint without processing more audio', async () => {
    const f = fixture()
    await f.receive({ type: 'load-model', requestId: 'model', buffer: new ArrayBuffer(8) })
    const run = f.receive({ type: 'transcribe', requestId: 'run', buffer: new Float32Array(65 * 16000).buffer, language: 'id', threads: 1, chunkSeconds: 30 })
    await tick()
    await f.receive({ type: 'checkpoint-failed', requestId: 'run' })
    await run
    expect(f.full).toHaveBeenCalledTimes(1)
    expect(f.messages.at(-1)).toMatchObject({ type: 'error' })
  })
})
