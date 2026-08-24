import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const api = spawn(process.execPath, ['server/index.ts'], { cwd: root, env: { ...process.env, TRANSKRIP_STATIC: '0' }, stdio: 'inherit' })
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' })

let closing = false
function close(code = 0) {
  if (closing) return
  closing = true
  api.kill('SIGTERM')
  vite.kill('SIGTERM')
  process.exitCode = code
}
api.on('exit', code => { if (!closing) close(code || 1) })
vite.on('exit', code => { if (!closing) close(code || 0) })
process.on('SIGINT', () => close(0))
process.on('SIGTERM', () => close(0))
