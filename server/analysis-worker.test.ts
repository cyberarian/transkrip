import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveAnalysisPython } from './analysis-worker.ts'

test('prefers an explicit analysis interpreter without shell parsing', () => {
  assert.equal(resolveAnalysisPython('/project', 'darwin', { TRANSKRIP_ANALYSIS_PYTHON: '/opt/python/bin/python' }, () => false), '/opt/python/bin/python')
})

test('discovers the project-local cross-platform analysis environment', () => {
  assert.equal(resolveAnalysisPython('/project', 'darwin', {}, path => path === '/project/.venv-analysis/bin/python'), '/project/.venv-analysis/bin/python')
  assert.equal(resolveAnalysisPython('C:\\project', 'win32', {}, path => path.endsWith('.venv-analysis\\Scripts\\python.exe')), 'C:\\project\\.venv-analysis\\Scripts\\python.exe')
})

test('falls back to the operating-system Python command', () => {
  assert.equal(resolveAnalysisPython('/project', 'linux', {}, () => false), 'python3')
  assert.equal(resolveAnalysisPython('C:\\project', 'win32', {}, () => false), 'python')
})
