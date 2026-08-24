export const MAX_AUDIO_FILE_BYTES = 250 * 1024 * 1024
export const MAX_AUDIO_DURATION_SECONDS = 4 * 60 * 60

export async function decodeAudio(file: File) {
  if (file.size > MAX_AUDIO_FILE_BYTES) throw new Error('audio-file-too-large')
  const context = new AudioContext()
  try {
    const source = await context.decodeAudioData(await file.arrayBuffer())
    if (!Number.isFinite(source.duration) || source.duration <= 0 || source.duration > MAX_AUDIO_DURATION_SECONDS) {
      throw new Error('audio-duration-out-of-range')
    }
    const offline = new OfflineAudioContext(1, Math.ceil(source.duration * 16000), 16000)
    const node = offline.createBufferSource()
    node.buffer = source
    node.connect(offline.destination)
    node.start()
    const rendered = await offline.startRendering()
    return { pcm: new Float32Array(rendered.getChannelData(0)), duration: source.duration }
  } finally {
    await context.close()
  }
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
