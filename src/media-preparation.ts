import { MAX_LOCAL_MEDIA_BYTES, MAX_MEDIA_SECONDS, MAX_PREPARED_BYTES, MEDIA_PREPARATION_TIMEOUT_MS, MEDIA_SAMPLE_RATE, isLoopbackHostname } from './media-limits'

export type MediaProgress = { phase: 'uploading' | 'converting' | 'downloading'; percent: number | null }

export function prepareLocalMedia(file: File, ownerId: number, signal: AbortSignal, onProgress: (progress: MediaProgress) => void): Promise<{ pcm: Float32Array; duration: number; hash: string }> {
  if (!isLoopbackHostname(location.hostname)) return Promise.reject(new Error('Persiapan media hanya tersedia pada perangkat lokal.'))
  if (!file.size || file.size > MAX_LOCAL_MEDIA_BYTES) return Promise.reject(new Error('Berkas harus berisi data dan maksimal 2 GB.'))
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let exceededLimit = false
    const abort = () => xhr.abort()
    const finish = () => signal.removeEventListener('abort', abort)
    if (signal.aborted) { reject(new DOMException('Dibatalkan', 'AbortError')); return }
    xhr.open('POST', '/api/media/prepare')
    xhr.responseType = 'arraybuffer'
    xhr.timeout = MEDIA_PREPARATION_TIMEOUT_MS + 60_000
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    if (ownerId) xhr.setRequestHeader('X-Workspace-Owner', String(ownerId))
    xhr.upload.onprogress = event => onProgress({ phase: 'uploading', percent: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null })
    xhr.upload.onload = () => onProgress({ phase: 'converting', percent: null })
    xhr.onprogress = event => {
      if (event.loaded > MAX_PREPARED_BYTES || (event.lengthComputable && event.total > MAX_PREPARED_BYTES)) { exceededLimit = true; xhr.abort(); return }
      onProgress({ phase: 'downloading', percent: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null })
    }
    xhr.onload = () => {
      finish()
      if (xhr.status !== 200) {
        let message = 'Persiapan media lokal gagal. Periksa FFmpeg atau gunakan mode browser.'
        try { message = JSON.parse(new TextDecoder().decode((xhr.response as ArrayBuffer).slice(0, 4096))).error.message || message } catch { /* use bounded generic error */ }
        if (xhr.status === 401) window.dispatchEvent(new Event('transkrip:unauthenticated'))
        reject(new Error(message)); return
      }
      const duration = Number(xhr.getResponseHeader('X-Audio-Duration'))
      const hash = xhr.getResponseHeader('X-Audio-Sha256') || ''
      const bytes = xhr.response as ArrayBuffer
      if (!(bytes instanceof ArrayBuffer) || !bytes.byteLength || bytes.byteLength > MAX_PREPARED_BYTES || bytes.byteLength % 4 || !Number.isFinite(duration) || duration <= 0 || duration > MAX_MEDIA_SECONDS || bytes.byteLength !== Math.round(duration * MEDIA_SAMPLE_RATE) * 4 || !/^[a-f0-9]{64}$/.test(hash)) {
        reject(new Error('Hasil persiapan media tidak valid.')); return
      }
      resolve({ pcm: new Float32Array(bytes), duration, hash })
    }
    xhr.onerror = () => { finish(); reject(new Error('Layanan lokal tidak dapat dihubungi. Coba lagi atau gunakan mode browser.')) }
    xhr.ontimeout = () => { finish(); reject(new Error('Persiapan media melewati batas waktu. Potong rekaman lalu coba lagi.')) }
    xhr.onabort = () => { finish(); reject(exceededLimit ? new Error('Audio hasil konversi melebihi batas aman.') : new DOMException('Dibatalkan', 'AbortError')) }
    signal.addEventListener('abort', abort, { once: true })
    try { xhr.send(file) } catch (error) { finish(); reject(error) }
  })
}
