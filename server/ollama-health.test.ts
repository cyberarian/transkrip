import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_CORRECTION_MODEL } from '../src/correction-model.ts'
import { OllamaHealthMonitor } from './ollama-health.ts'

test('reports a connected local Ollama with bounded inventory metadata', async () => {
  const fetcher = async () => new Response(JSON.stringify({ models: [
    { name: DEFAULT_CORRECTION_MODEL },
    { name: 'another-local-model:Q4_K_M' },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const monitor = new OllamaHealthMonitor(fetcher as typeof fetch)

  const result = await monitor.check()

  assert.equal(result.status, 'connected')
  assert.equal(result.modelCount, 2)
  assert.equal(result.recommendedModelAvailable, true)
  assert.equal(typeof result.latencyMs, 'number')
  assert.match(result.checkedAt || '', /^\d{4}-\d{2}-\d{2}T/)
})

test('contains unreachable or malformed Ollama responses as unavailable status', async () => {
  const unreachable = new OllamaHealthMonitor((async () => { throw new TypeError('connection refused with private detail') }) as typeof fetch)
  const malformed = new OllamaHealthMonitor((async () => new Response('{"models":"invalid"}', { status: 200 })) as typeof fetch)

  assert.deepEqual((await unreachable.check()).reason, 'unreachable')
  assert.deepEqual((await malformed.check()).reason, 'invalid_response')
  assert.equal(unreachable.snapshot().status, 'unavailable')
  assert.equal(JSON.stringify(unreachable.snapshot()).includes('private detail'), false)
})

test('deduplicates concurrent health checks against the local service', async () => {
  let calls = 0
  let release!: () => void
  const wait = new Promise<void>(resolve => { release = resolve })
  const fetcher = async () => { calls += 1; await wait; return new Response('{"models":[]}') }
  const monitor = new OllamaHealthMonitor(fetcher as typeof fetch)

  const first = monitor.check()
  const second = monitor.check()
  release()

  assert.equal(await first, await second)
  assert.equal(calls, 1)
})
