const WAV_HEADER_BYTES = 44
const MAX_DIARIZATION_WAV_BYTES = 250 * 1024 * 1024

export function encodePcm16Wav(pcm: Float32Array, sampleRate = 16_000) {
  const size = WAV_HEADER_BYTES + pcm.length * 2
  if (size > MAX_DIARIZATION_WAV_BYTES) return null
  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, size - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i += 1) view.setInt16(WAV_HEADER_BYTES + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * (pcm[i] < 0 ? 32768 : 32767)), true)
  return new Blob([buffer], { type: 'audio/wav' })
}
