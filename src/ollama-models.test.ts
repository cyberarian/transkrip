import { describe, expect, it, vi } from 'vitest'
import { listLocalOllamaModels, parseOllamaModels } from './ollama-models'

describe('parseOllamaModels', () => {
  it('accepts the documented Ollama tags response and keeps display metadata', () => {
    expect(parseOllamaModels({
      models: [{
        name: 'csalab/sahabatai1:llama3_base_Q4_K_M',
        model: 'csalab/sahabatai1:llama3_base_Q4_K_M',
        size: 4_200_000_000,
        details: { family: 'qwen2', parameter_size: '7.6B', quantization_level: 'Q4_K_M' },
      }],
    })).toEqual([{
      name: 'csalab/sahabatai1:llama3_base_Q4_K_M',
      size: 4_200_000_000,
      family: 'qwen2',
      parameterSize: '7.6B',
      quantization: 'Q4_K_M',
    }])
  })

  it('drops malformed entries and rejects a malformed top-level response', () => {
    expect(parseOllamaModels({ models: [{ name: 'bad model' }, null, { name: 'valid:latest' }] })).toEqual([
      { name: 'valid:latest', size: null, family: null, parameterSize: null, quantization: null },
    ])
    expect(() => parseOllamaModels({ models: 'not-an-array' })).toThrow('Daftar model Ollama tidak valid.')
  })

  it('loads inventory through the authenticated production API instead of a development-only proxy', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{
      name: 'csalab/sahabatai1:llama3_base_Q4_K_M',
      size: 4_200_000_000,
      family: 'llama',
      parameterSize: '8B',
      quantization: 'Q4_K_M',
    }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await expect(listLocalOllamaModels(undefined, fetcher as unknown as typeof fetch)).resolves.toHaveLength(1)
    expect(fetcher).toHaveBeenCalledWith('/api/runtime/ollama/models', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }))
  })
})
