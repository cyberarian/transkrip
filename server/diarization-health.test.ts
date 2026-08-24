import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DiarizationHealthMonitor } from './diarization-health.ts'

test('reports ready only for a valid bounded loopback health response', async () => {
  const monitor = new DiarizationHealthMonitor(async () => new Response(JSON.stringify({ status: 'ready' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Length': '18' },
  }) as typeof fetch)

  const result = await monitor.check()
  assert.equal(result.status, 'ready')
  assert.equal(result.reason, null)
  assert.ok(result.checkedAt)
})

test('fails closed when the sidecar health response is malformed', async () => {
  const monitor = new DiarizationHealthMonitor(async () => new Response(JSON.stringify({ status: 'warming' }), { status: 200 }) as typeof fetch)

  const result = await monitor.check()
  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'invalid_response')
})

test('deduplicates concurrent readiness probes', async () => {
  let calls = 0
  const fetcher = (async () => {
    calls += 1
    await Promise.resolve()
    return new Response(JSON.stringify({ status: 'ready' }), { status: 200 })
  }) as typeof fetch
  const monitor = new DiarizationHealthMonitor(fetcher)

  const [first, second] = await Promise.all([monitor.check(), monitor.check()])
  assert.equal(calls, 1)
  assert.deepEqual(first, second)
})
