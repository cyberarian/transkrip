export const MAX_AUDIO_FILE_BYTES = 250 * 1024 * 1024
export const MAX_AUDIO_DURATION_SECONDS = 4 * 60 * 60
// Large recordings warn before decoding; the confirm threshold matches the load-time hints.
export const LARGE_AUDIO_HINT_BYTES = 100 * 1024 * 1024

const TARGET_SAMPLE_RATE = 16000
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv'])

function isVideoFile(file: File): boolean {
  // Strip query string and hash before extracting extension
  const name = file.name.toLowerCase().replace(/[?#].*$/, '')
  const ext = name.slice(name.lastIndexOf('.'))
  // Only treat as video if MIME type explicitly says video, or extension is a known video format
  // Audio-only MP4 files (audio/mp4) should NOT be treated as video
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)
}

export { isVideoFile }

export async function readAudioBytes(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<ArrayBuffer> {
  signal?.throwIfAborted()
  if (file.size > MAX_AUDIO_FILE_BYTES) throw new Error('audio-file-too-large')
  // Fill one allocation instead of retaining all stream chunks and then copying them.
  const bytes = new Uint8Array(file.size)
  const reader = file.stream().getReader()
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal?.addEventListener('abort', cancel, { once: true })
  let received = 0
  let lastProgress = -1
  try {
    while (true) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) break
      bytes.set(value, received)
      received += value.length
      const progress = Math.min(99, Math.round(received / file.size * 100))
      if (progress !== lastProgress) { onProgress?.(progress); lastProgress = progress }
    }
    if (received !== file.size) throw new Error('audio-read-incomplete')
    return bytes.buffer
  } finally {
    signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

// ArrayBuffer input is consumed by decodeAudioData. Finish hashing it first.
export async function decodeAudio(file: File | ArrayBuffer, signal?: AbortSignal): Promise<{ pcm: Float32Array; duration: number }> {
  signal?.throwIfAborted()
  const size = file instanceof File ? file.size : file.byteLength
  if (size > MAX_AUDIO_FILE_BYTES) throw new Error('audio-file-too-large')
  const bytes = file instanceof File ? await readAudioBytes(file, undefined, signal) : file
  // Decode directly at the target rate. A one-frame offline context avoids an
  // output device and a second full-duration render buffer. Video containers
  // use the same decoder when their audio codec is supported by the browser.
  const context = new OfflineAudioContext(1, 1, TARGET_SAMPLE_RATE)
  let source: AudioBuffer
  try {
    source = await context.decodeAudioData(bytes)
  } catch (error) {
    if (error instanceof RangeError) throw new Error('audio-file-too-large', { cause: error })
    throw new Error(`decode-audio-failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  signal?.throwIfAborted()
  const duration = source.duration
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_AUDIO_DURATION_SECONDS) {
    throw new Error('audio-duration-out-of-range')
  }
  if (source.numberOfChannels === 1) return { pcm: source.getChannelData(0), duration }

  const pcm = new Float32Array(source.length)
  const channels = Array.from({ length: source.numberOfChannels }, (_, index) => source.getChannelData(index))
  // Bound synchronous work so long recordings do not freeze the interface.
  const blockSize = TARGET_SAMPLE_RATE * 10
  for (let offset = 0; offset < pcm.length; offset += blockSize) {
    signal?.throwIfAborted()
    const end = Math.min(offset + blockSize, pcm.length)
    for (const channel of channels) {
      for (let index = offset; index < end; index++) pcm[index] += channel[index] / channels.length
    }
    if (end < pcm.length) await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
  return { pcm, duration }
}

export function formatTime(seconds: number, detailed = false) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const normalized = detailed ? Math.round(safe * 1000) / 1000 : safe
  const hours = Math.floor(normalized / 3600)
  const minutes = Math.floor((normalized % 3600) / 60)
  const secs = detailed ? (normalized % 60).toFixed(3).padStart(6, '0') : Math.floor(normalized % 60).toString().padStart(2, '0')
  return hours > 0 ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs}` : `${minutes.toString().padStart(2, '0')}:${secs}`
}

export function formatSrtTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const totalMillis = Math.round(safe * 1000)
  const hours = Math.floor(totalMillis / 3_600_000)
  const minutes = Math.floor((totalMillis % 3_600_000) / 60_000)
  const secs = Math.floor((totalMillis % 60_000) / 1000)
  const millis = totalMillis % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`
}
