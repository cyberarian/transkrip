import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, posix, win32 } from 'node:path'

type Environment = Record<string, string | undefined>

export function resolveAnalysisPython(projectRoot: string, platform = process.platform, environment: Environment = process.env, exists: (path: string) => boolean = existsSync) {
  const configured = environment.TRANSKRIP_ANALYSIS_PYTHON?.trim()
  if (configured) return configured
  const local = platform === 'win32' ? win32.join(projectRoot, '.venv-analysis', 'Scripts', 'python.exe') : posix.join(projectRoot, '.venv-analysis', 'bin', 'python')
  return exists(local) ? local : platform === 'win32' ? 'python' : 'python3'
}

export function startAnalysisWorker(projectRoot: string) {
  if (process.env.TRANSKRIP_ANALYSIS_AUTOSTART === '0') return null
  const python = resolveAnalysisPython(projectRoot)
  const child = spawn(python, [join(projectRoot, 'analysis', 'service.py')], { cwd: projectRoot, env: process.env, stdio: ['ignore', 'inherit', 'inherit'], shell: false })
  child.on('spawn', () => console.info(JSON.stringify({ level: 'info', event: 'docetl_worker_started', interpreter: python.includes('.venv-analysis') ? 'project-environment' : 'system' })))
  child.on('error', error => console.warn(JSON.stringify({ level: 'warn', event: 'docetl_worker_start_failed', errorType: error.name })))
  child.on('exit', code => { if (code && code !== 0) console.warn(JSON.stringify({ level: 'warn', event: 'docetl_worker_exited', code })) })
  return child
}
