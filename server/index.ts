import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiHandler } from './app.ts'
import { TranscriptionStore } from './database.ts'
import { AudioStaging } from './diarization.ts'
import { hashPassword, normalizeUsername } from './auth.ts'
import { OllamaHealthMonitor } from './ollama-health.ts'
import { DiarizationHealthMonitor } from './diarization-health.ts'
import { DocetlClient } from './docetl-client.ts'
import { startAnalysisWorker } from './analysis-worker.ts'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const analysisWorker = startAnalysisWorker(projectRoot)
const dataPath = process.env.TRANSKRIP_DB_PATH || join(projectRoot, 'data', 'transkrip.sqlite')
const distPath = join(projectRoot, 'dist')
const port = Number(process.env.TRANSKRIP_PORT || 8787)
const host = process.env.TRANSKRIP_HOST || '127.0.0.1'
const serveStatic = process.env.TRANSKRIP_STATIC !== '0'
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('TRANSKRIP_PORT tidak valid.')

const bootstrapUsername = process.env.TRANSKRIP_ADMIN_USERNAME
const bootstrapPassword = process.env.TRANSKRIP_ADMIN_PASSWORD
if (Boolean(bootstrapUsername) !== Boolean(bootstrapPassword)) throw new Error('TRANSKRIP_ADMIN_USERNAME dan TRANSKRIP_ADMIN_PASSWORD harus diatur bersama.')
const bootstrapAdmin = bootstrapUsername && bootstrapPassword ? {
  username: normalizeUsername(bootstrapUsername),
  displayName: (process.env.TRANSKRIP_ADMIN_DISPLAY_NAME || bootstrapUsername).trim().slice(0, 100),
  credential: await hashPassword(bootstrapPassword),
} : undefined
const store = new TranscriptionStore(dataPath, bootstrapAdmin)
const ollama = new OllamaHealthMonitor(fetch)
const diarizationHealth = new DiarizationHealthMonitor(fetch)
const docetl = new DocetlClient(fetch)
const api = createApiHandler(store, fetch, new AudioStaging(join(projectRoot, 'data', 'audio-staging')), ollama, diarizationHealth, docetl)
const mime = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.bin', 'application/octet-stream'], ['.wasm', 'application/wasm'], ['.woff2', 'font/woff2'], ['.svg', 'image/svg+xml']])
const securityHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'none'; frame-ancestors 'none'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; worker-src 'self' blob:",
}

function headersFor(path: string) {
  if (path === '/whisper/engine-worker.js') return { ...securityHeaders, 'Content-Security-Policy': securityHeaders['Content-Security-Policy'].replace("script-src 'self'", "script-src 'self' 'unsafe-eval'") }
  return securityHeaders
}

const server = createServer(async (request, response) => {
  if ((request.url || '').startsWith('/api/')) return api(request, response)
  if (!serveStatic) { response.writeHead(404); response.end(); return }
  const rawPath = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname)
  const requested = rawPath === '/' ? 'index.html' : rawPath.slice(1)
  let filePath = resolve(distPath, requested)
  if (!filePath.startsWith(`${distPath}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(distPath, 'index.html')
  if (!existsSync(filePath)) { response.writeHead(503, securityHeaders); response.end('Jalankan npm run build terlebih dahulu.'); return }
  response.writeHead(200, { ...headersFor(rawPath), 'Content-Type': mime.get(extname(filePath)) || 'application/octet-stream', 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  createReadStream(filePath).pipe(response)
})

server.listen(port, host, () => {
  console.info(JSON.stringify({ level: 'info', event: 'server_started', origin: `http://${host}:${port}`, database: 'local' }))
  void ollama.check().then(result => console.info(JSON.stringify({ level: result.status === 'connected' ? 'info' : 'warn', event: 'ollama_startup_check', status: result.status, reason: result.reason, latencyMs: result.latencyMs, modelCount: result.modelCount, recommendedModelAvailable: result.recommendedModelAvailable })))
  void diarizationHealth.check().then(result => console.info(JSON.stringify({ level: result.status === 'ready' ? 'info' : 'warn', event: 'diarization_startup_check', status: result.status, reason: result.reason, latencyMs: result.latencyMs })))
  void docetl.check().then(result => console.info(JSON.stringify({ level: result.status === 'ready' ? 'info' : 'warn', event: 'docetl_startup_check', status: result.status, reason: result.reason, latencyMs: result.latencyMs, version: result.version })))
})

function shutdown() {
  analysisWorker?.kill('SIGTERM')
  server.close(() => { store.close(); process.exit(0) })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
