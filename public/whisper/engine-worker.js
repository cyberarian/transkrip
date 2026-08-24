/* whisper.cpp runs here so synchronous WASM inference never blocks the interface. */
const SAMPLE_RATE = 16000
const DEFAULT_CHUNK_SECONDS = 30
const VALID_CHUNK_SECONDS = new Set([30, 60])
const OVERLAP_SECONDS = 1
const MAX_AUDIO_SECONDS = 4 * 60 * 60
const CHUNK_TIMEOUT_MS = 15 * 60 * 1000
const VALID_LANGUAGES = new Set(['auto', 'id', 'en'])
const timestamp = /^\s*\[(\d{2}):(\d{2}):(\d{2})\.(\d{3}) --> (\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.*)$/
const completedTiming = /whisper_print_timings:\s+total time/
const toSeconds = parts => Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]) + Number(parts[3]) / 1000

let instance = 0
let chunkOffset = 0
let acceptAfter = 0
let activeLanguage = 'auto'
let activeRequestId
let pendingChunk
let segmentsEmitted = 0
let resolveRuntime
const runtimeReady = new Promise(resolve => { resolveRuntime = resolve })

const send = message => self.postMessage(message)
const friendlyError = error => {
  const detail = error instanceof Error ? error.message : String(error)
  if (/typed array|memory|allocate|abort/i.test(detail)) return 'Memori worker tidak cukup untuk bagian audio ini. Muat ulang aplikasi atau gunakan model Small Q5_1.'
  return detail
}

const emit = line => {
  const match = line.match(timestamp)
  if (match) {
    const localStart = toSeconds(match.slice(1, 5))
    const localEnd = toSeconds(match.slice(5, 9))
    const text = match[9].trim()
    if (text && localEnd > acceptAfter) {
      segmentsEmitted += 1
      send({
        type: 'segment',
        segment: {
          id: crypto.randomUUID(),
          start: chunkOffset + localStart,
          end: chunkOffset + localEnd,
          text,
          language: activeLanguage,
        },
      })
    }
  } else if (completedTiming.test(line)) {
    pendingChunk?.resolve()
  } else if (line.trim() && !line.includes('whisper_print_timings:')) send({ type: 'log', message: line })
}

const runWhisperChunk = (audio, language, threads, index, total) => new Promise((resolve, reject) => {
  let settled = false
  const finish = callback => value => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    pendingChunk = undefined
    callback(value)
  }
  const timer = setTimeout(
    () => pendingChunk?.reject(new Error(`whisper.cpp melewati batas waktu pada bagian ${index + 1} dari ${total}.`)),
    CHUNK_TIMEOUT_MS,
  )
  pendingChunk = { resolve: finish(resolve), reject: finish(reject) }

  try {
    const result = Module.full_default(instance, audio, language, threads, false)
    if (result !== 0) pendingChunk.reject(new Error(`whisper.cpp berhenti dengan kode ${result} pada bagian ${index + 1} dari ${total}.`))
  } catch (error) {
    pendingChunk.reject(error)
  }
})

self.Module = {
  print: emit,
  printErr: emit,
  onAbort: reason => {
    const error = new Error(friendlyError(reason))
    if (pendingChunk) pendingChunk.reject(error)
    else send({ type: 'error', requestId: activeRequestId, message: error.message })
  },
  onRuntimeInitialized: () => { resolveRuntime(); send({ type: 'runtime-ready' }) },
}
var Module = self.Module
importScripts('/whisper/main.js')

self.addEventListener('message', async event => {
  const message = event.data
  if (!message || typeof message !== 'object' || typeof message.requestId !== 'string') return
  activeRequestId = message.requestId
  try {
    await runtimeReady
    if (message.type === 'load-model') {
      if (!(message.buffer instanceof ArrayBuffer) || message.buffer.byteLength === 0) throw new Error('Data model tidak valid.')
      if (instance) { Module.free(instance); instance = 0 }
      try { Module.FS_unlink('/whisper.bin') } catch { /* first model */ }
      Module.FS_createDataFile('/', 'whisper.bin', new Uint8Array(message.buffer), true, true)
      instance = Module.init('whisper.bin')
      if (!instance) throw new Error('Model tidak dapat dibuka oleh whisper.cpp.')
      send({ type: 'model-ready', requestId: message.requestId })
      return
    }

    if (message.type === 'transcribe') {
      if (!instance) throw new Error('Pilih model multilingual terlebih dahulu.')
      if (!(message.buffer instanceof ArrayBuffer) || message.buffer.byteLength === 0) throw new Error('Data audio tidak valid.')
      if (message.buffer.byteLength > MAX_AUDIO_SECONDS * SAMPLE_RATE * Float32Array.BYTES_PER_ELEMENT) throw new Error('Audio melebihi batas durasi empat jam.')
      if (!VALID_LANGUAGES.has(message.language)) throw new Error('Pilihan bahasa tidak valid.')
      const audio = new Float32Array(message.buffer)
      activeLanguage = message.language
      const threads = Math.max(1, Math.min(8, Number.isInteger(message.threads) ? message.threads : 1))
      const chunkSeconds = VALID_CHUNK_SECONDS.has(message.chunkSeconds) ? message.chunkSeconds : DEFAULT_CHUNK_SECONDS
      const chunkSamples = chunkSeconds * SAMPLE_RATE
      const overlapSamples = OVERLAP_SECONDS * SAMPLE_RATE
      const stepSamples = chunkSamples - overlapSamples
      const total = Math.max(1, Math.ceil(Math.max(0, audio.length - overlapSamples) / stepSamples))
      segmentsEmitted = 0

      for (let index = 0, start = 0; start < audio.length; index += 1, start += stepSamples) {
        const end = Math.min(audio.length, start + chunkSamples)
        chunkOffset = start / SAMPLE_RATE
        acceptAfter = start === 0 ? 0 : OVERLAP_SECONDS
        send({ type: 'progress', completed: index, total })
        await runWhisperChunk(audio.subarray(start, end), message.language, threads, index, total)
      }
      if (segmentsEmitted === 0) throw new Error('Tidak ada ucapan yang dapat dikenali dalam audio ini.')
      send({ type: 'progress', completed: total, total })
      send({ type: 'done', requestId: message.requestId })
      return
    }

    throw new Error('Perintah worker tidak dikenal.')
  } catch (error) {
    send({ type: 'error', requestId: message.requestId, message: friendlyError(error) })
  } finally {
    activeRequestId = undefined
    chunkOffset = 0
    acceptAfter = 0
    activeLanguage = 'auto'
    segmentsEmitted = 0
  }
})
