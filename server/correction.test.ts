import assert from 'node:assert/strict'
import { test } from 'node:test'
import { correctTextWithOllama } from './correction.ts'

test('corrects paragraphs with the selected local model and preserves paragraph structure', async () => {
  const requests: Array<Record<string, unknown>> = []
  const outputs = ['{"corrected":"Kalimat pertama."}', '{"corrected":"Kalimat kedua."}']
  const fetcher = async (_input: string | URL | globalThis.Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return new Response(JSON.stringify({ message: { content: outputs.shift() } }))
  }

  const result = await correctTextWithOllama('Kalimat pertama.\n\nKalimat kedua.', 'csalab/sahabatai1:llama3_base_Q4_K_M', fetcher as typeof fetch)

  assert.equal(result.text, 'Kalimat pertama.\n\nKalimat kedua.')
  assert.equal(requests.length, 2)
  assert.equal(requests[0].model, 'csalab/sahabatai1:llama3_base_Q4_K_M')
})

test('preserves original text when the model changes meaning', async () => {
  const fetcher = async () => new Response(JSON.stringify({ message: { content: '{"corrected":"Please check the activity team."}' } }))

  const result = await correctTextWithOllama('Silahkan cek aktifitas tim.', 'csalab/sahabatai1:llama3_base_Q4_K_M', fetcher as typeof fetch)

  assert.equal(result.text, 'Silahkan cek aktifitas tim.')
  assert.equal(result.changed, 0)
})
