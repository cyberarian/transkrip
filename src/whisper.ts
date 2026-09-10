import type { Segment } from './types'

type WorkerReply =
  | { type: 'runtime-ready' }
  | { type: 'model-ready'; requestId: string }
  | { type: 'segment'; segment: Segment }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'done'; requestId: string }
  | { type: 'checkpoint'; requestId: string; nextSample: number; completed: number; total: number }
  | { type: 'log'; message: string }
  | { type: 'error'; requestId?: string; message: string }

type Pending = { resolve: () => void; reject: (error: Error) => void }

function isWorkerReply(value: unknown): value is WorkerReply {
  if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return false
  const message = value as Record<string, unknown>
  if (message.type === 'runtime-ready') return true
  if (message.type === 'model-ready' || message.type === 'done') return typeof message.requestId === 'string'
  if (message.type === 'log') return typeof message.message === 'string'
  if (message.type === 'checkpoint') return typeof message.requestId === 'string' && Number.isSafeInteger(message.nextSample) && Number(message.nextSample) >= 0 && Number.isSafeInteger(message.completed) && Number.isSafeInteger(message.total)
  if (message.type === 'progress') return Number.isFinite(message.completed) && Number.isFinite(message.total)
  if (message.type === 'error') return typeof message.message === 'string' && (message.requestId === undefined || typeof message.requestId === 'string')
  if (message.type !== 'segment' || !message.segment || typeof message.segment !== 'object') return false
  const segment = message.segment as Record<string, unknown>
  return typeof segment.id === 'string'
    && Number.isFinite(segment.start)
    && Number.isFinite(segment.end)
    && typeof segment.text === 'string'
    && (segment.language === 'id' || segment.language === 'en' || segment.language === 'auto')
}

export class WhisperEngine {
  private worker: Worker
  private pending = new Map<string, Pending>()
  private destroyed = false
  onSegment: (segment: Segment) => void = () => undefined
  onDone: () => void = () => undefined
  onProgress: (completed: number, total: number) => void = () => undefined
  onCheckpoint: (nextSample: number) => Promise<void> = async () => undefined
  onLog: (line: string) => void = () => undefined

  constructor() { this.worker = this.createWorker() }

  private createWorker() {
    const worker = new Worker('/whisper/engine-worker.js', { name: 'transkrip-whisper-engine' })
    worker.addEventListener('message', event => {
      if (!isWorkerReply(event.data)) {
        this.failAll('Worker whisper.cpp mengirim data yang tidak valid.')
        return
      }
      this.handleMessage(event.data)
    })
    worker.addEventListener('error', () => this.failAll('Worker whisper.cpp berhenti. Muat ulang aplikasi untuk memulai ulang mesin transkripsi.'))
    worker.addEventListener('messageerror', () => this.failAll('Data tidak dapat dikirim ke worker whisper.cpp. Muat ulang aplikasi lalu coba lagi.'))
    return worker
  }

  private handleMessage(message: WorkerReply) {
    if (message.type === 'segment') this.onSegment(message.segment)
    else if (message.type === 'progress') this.onProgress(message.completed, message.total)
    else if (message.type === 'checkpoint') {
      if (!this.pending.has(message.requestId)) return
      void this.onCheckpoint(message.nextSample).then(() => {
        if (!this.destroyed) this.worker.postMessage({ type: 'checkpoint-saved', requestId: message.requestId })
      }, () => {
        if (!this.destroyed) this.worker.postMessage({ type: 'checkpoint-failed', requestId: message.requestId })
      })
    }
    else if (message.type === 'log') this.onLog(message.message)
    else if (message.type === 'model-ready') this.finish(message.requestId)
    else if (message.type === 'done') { this.finish(message.requestId); this.onDone() }
    else if (message.type === 'error') {
      if (message.requestId) this.fail(message.requestId, message.message)
      else this.failAll(message.message)
    }
  }

  private finish(requestId: string) {
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    pending.resolve()
  }

  private fail(requestId: string, message: string) {
    const pending = this.pending.get(requestId)
    if (!pending) return
    this.pending.delete(requestId)
    pending.reject(new Error(message))
  }

  private failAll(message: string) {
    for (const requestId of this.pending.keys()) this.fail(requestId, message)
  }

  private request(type: 'load-model' | 'transcribe', payload: Record<string, unknown>, transfer: Transferable[]) {
    if (this.destroyed) return Promise.reject(new Error('Mesin transkripsi sudah ditutup.'))
    if (this.pending.size > 0) return Promise.reject(new Error('Mesin transkripsi sedang menjalankan operasi lain.'))
    const requestId = crypto.randomUUID()
    const promise = new Promise<void>((resolve, reject) => this.pending.set(requestId, { resolve, reject }))
    try {
      this.worker.postMessage({ type, requestId, ...payload }, transfer)
    } catch (error) {
      this.fail(requestId, error instanceof Error ? error.message : String(error))
    }
    return promise
  }

  loadModel(buffer: ArrayBuffer) {
    if (this.destroyed || this.pending.size) return Promise.reject(new Error('Mesin belum siap memuat model.'))
    this.worker.terminate()
    this.worker = this.createWorker()
    return this.request('load-model', { buffer }, [buffer])
  }

  transcribe(audio: Float32Array, language: string, threads: number, chunkSeconds: number, startSample = 0) {
    const workerAudio = audio.slice()
    return this.request('transcribe', { buffer: workerAudio.buffer, language, threads, chunkSeconds, startSample }, [workerAudio.buffer])
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.failAll('Mesin transkripsi ditutup.')
    this.worker.terminate()
  }
}
