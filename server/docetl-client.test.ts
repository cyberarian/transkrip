import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DocetlClient } from './docetl-client.ts'

test('checks the fixed loopback DocETL health endpoint', async () => {
  let requested = ''
  const client = new DocetlClient(async (input, init) => {
    requested = String(input)
    assert.equal(init?.redirect, 'error')
    return new Response(JSON.stringify({ status: 'ready', version: '0.3.0' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  const result = await client.check()
  assert.equal(requested, 'http://127.0.0.1:8770/health')
  assert.equal(result.status, 'ready')
  assert.equal(result.version, '0.3.0')
})

test('maps an unavailable optional dependency without leaking response content', async () => {
  const client = new DocetlClient(async () => new Response(JSON.stringify({ status: 'unavailable', reason: 'dependency_missing' }), { status: 503 }))
  const result = await client.check()
  assert.equal(result.status, 'unavailable')
  assert.equal(result.reason, 'dependency_missing')
})

test('runs a bounded local analysis and validates worker output', async () => {
  const phases: string[] = []
  const client = new DocetlClient(async (input, init) => {
    assert.equal(String(input), 'http://127.0.0.1:8770/analyze')
    const body = JSON.parse(String(init?.body)) as { documents: unknown[]; model: string }
    assert.equal(body.documents.length, 1)
    assert.equal(body.model, 'local/model:q4')
    return new Response(JSON.stringify({ summary: 'Ringkas', primary: 'Satu', secondary: 'Dua', tertiary: 'Tiga' }), { status: 200 })
  })
  assert.deepEqual(await client.analyze({ preset: 'meeting_minutes', model: 'local/model:q4', documents: [{ id: 1, source: 'rapat.wav', text: 'Isi rapat.' }] }, phase => phases.push(phase)), {
    summary: 'Ringkas', primary: 'Satu', secondary: 'Dua', tertiary: 'Tiga',
  })
  assert.deepEqual(phases, ['generating', 'validating'])
})

test('rejects malformed analysis output from the local worker', async () => {
  const client = new DocetlClient(async () => new Response(JSON.stringify({ summary: ['unexpected'] }), { status: 200 }))
  await assert.rejects(() => client.analyze({ preset: 'meeting_minutes', model: 'local/model:q4', documents: [{ id: 1, source: 'rapat.wav', text: 'Isi.' }] }), /tidak valid/i)
})
