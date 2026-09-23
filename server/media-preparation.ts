import { createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, open, readdir, rm, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { MAX_LOCAL_MEDIA_BYTES, MAX_MEDIA_SECONDS, MAX_PREPARED_BYTES, MEDIA_PREPARATION_TIMEOUT_MS, MEDIA_SAMPLE_RATE } from '../src/media-limits.ts'

export class MediaPreparationError extends Error {
  readonly status: number
  constructor(status: number, message: string, options?: ErrorOptions) { super(message, options); this.status = status }
}

export class MediaPreparation {
  readonly #root: string
  readonly #binary: string
  #busy = false
  #initialized: Promise<void> | null = null
  constructor(root: string, binary = process.env.TRANSKRIP_FFMPEG || 'ffmpeg') { this.#root = root; this.#binary = binary }

  async #initialize() {
    await mkdir(this.#root, { recursive: true, mode: 0o700 })
    // This directory belongs to one local server instance. Remove only this
    // service's randomly named workspaces left by an interrupted process.
    for (const entry of await readdir(this.#root)) if (/^media-[A-Za-z0-9]{6}$/.test(entry)) await rm(join(this.#root, entry), { recursive: true, force: true })
  }

  async prepare(input: Readable, declaredBytes: number, signal: AbortSignal) {
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 1 || declaredBytes > MAX_LOCAL_MEDIA_BYTES) throw new MediaPreparationError(413, 'Berkas harus berisi data dan maksimal 2 GB.')
    signal.throwIfAborted()
    if (this.#busy) throw new MediaPreparationError(429, 'Persiapan lokal sedang berjalan. Tunggu lalu coba lagi.')
    this.#busy = true
    let directory: string | undefined
    let disposed = false
    const dispose = async () => {
      if (disposed) return
      disposed = true
      try { if (directory) await rm(directory, { recursive: true, force: true }) }
      finally { this.#busy = false }
    }
    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(MEDIA_PREPARATION_TIMEOUT_MS)])
    try {
      this.#initialized ??= this.#initialize()
      await this.#initialized
      directory = await mkdtemp(join(this.#root, 'media-'))
      const inputPath = join(directory, 'input')
      const outputPath = join(directory, 'audio.pcm')
      const hash = createHash('sha256')
      let received = 0
      const counter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length
        if (received > declaredBytes) { callback(new MediaPreparationError(413, 'Ukuran berkas tidak sesuai.')); return }
        hash.update(chunk); callback(null, chunk)
      } })
      await pipeline(input, counter, createWriteStream(inputPath, { flags: 'wx', mode: 0o600 }), { signal: boundedSignal })
      if (received !== declaredBytes) throw new MediaPreparationError(400, 'Berkas tidak diterima lengkap.')
      boundedSignal.throwIfAborted()
      const handle = await open(inputPath, 'r')
      try {
        // fd keeps MP4 input seekable without granting FFmpeg access to paths,
        // URLs, playlists, or other local files referenced by an uploaded file.
        const child = spawn(this.#binary, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-max_alloc', '67108864',
          '-protocol_whitelist', 'fd,pipe', '-format_whitelist', 'wav,mp3,mov,matroska,webm,ogg,flac,aac,aiff,avi,asf',
          '-threads', '2', '-fd', '3', '-i', 'fd:', '-map', '0:a:0', '-vn', '-sn', '-dn', '-threads', '2',
          '-t', String(MAX_MEDIA_SECONDS + 1), '-ac', '1', '-ar', String(MEDIA_SAMPLE_RATE), '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
        { stdio: ['ignore', 'pipe', 'ignore', handle.fd], windowsHide: true })
        const kill = () => { child.kill('SIGKILL') }
        boundedSignal.addEventListener('abort', kill, { once: true })
        if (boundedSignal.aborted) kill()
        let outputBytes = 0
        const outputCounter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
          outputBytes += chunk.length
          if (outputBytes > MAX_PREPARED_BYTES) { callback(new MediaPreparationError(413, 'Durasi audio melebihi empat jam.')); return }
          callback(null, chunk)
        } })
        const completion = new Promise<void>((resolve, reject) => {
          let spawnError: Error | null = null
          child.once('error', error => { spawnError = error })
          child.once('close', code => {
            if (spawnError) reject(new MediaPreparationError(503, 'FFmpeg lokal belum tersedia. Pasang FFmpeg atau gunakan mode browser.', { cause: spawnError }))
            else if (code === 0) resolve()
            else reject(new MediaPreparationError(422, 'Audio tidak dapat dibaca. Periksa codec dan trek audio pada berkas.'))
          })
        })
        const output = pipeline(child.stdout!, outputCounter, createWriteStream(outputPath, { flags: 'wx', mode: 0o600 }), { signal: boundedSignal })
        try {
          await Promise.all([completion, output])
        } catch (error) {
          kill()
          await Promise.allSettled([completion, output])
          boundedSignal.throwIfAborted()
          throw error
        } finally { boundedSignal.removeEventListener('abort', kill) }
      } finally { await handle.close() }
      const size = (await stat(outputPath)).size
      if (!size || size % 4) throw new MediaPreparationError(422, 'Berkas tidak memiliki audio yang dapat ditranskripsikan.')
      await rm(inputPath)
      return { path: outputPath, bytes: size, duration: size / 4 / MEDIA_SAMPLE_RATE, hash: hash.digest('hex'), dispose }
    } catch (error) {
      await dispose()
      throw error
    }
  }
}

