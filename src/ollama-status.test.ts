import { describe, expect, it, vi } from 'vitest'
import { checkOllamaStatus, getOllamaStatus, parseOllamaStatus } from './ollama-status'

const connected = {
  status: 'connected',
  checkedAt: '2026-08-14T06:30:00.000Z',
  latencyMs: 18,
  modelCount: 3,
  recommendedModelAvailable: true,
  reason: null,
}

describe('Ollama runtime status client', () => {
  it('accepts only the bounded status contract', () => {
    expect(parseOllamaStatus(connected)).toEqual(connected)
    expect(() => parseOllamaStatus({ ...connected, status: 'remote' })).toThrow('Status Ollama tidak valid.')
    expect(() => parseOllamaStatus({ ...connected, modelCount: 100_001 })).toThrow('Status Ollama tidak valid.')
  })

  it('reads startup status and requests a same-origin manual recheck', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: connected }), { status: 200 })) as unknown as typeof fetch

    await getOllamaStatus(fetcher)
    await checkOllamaStatus(fetcher)

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/runtime/ollama', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }))
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/runtime/ollama', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }))
  })
})
