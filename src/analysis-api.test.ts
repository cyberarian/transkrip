import { describe, expect, it, vi } from 'vitest'
import { checkDocetl, createAnalysis, deleteAnalysis, getAnalysis, listAnalyses } from './analysis-api'

const run = { id: 7, preset: 'meeting_minutes', model: 'local/model:q4', transcriptionIds: [2], sourceNames: ['rapat.wav'], result: null, status: 'pending', progressPhase: 'queued', errorMessage: null, createdAt: '2026-08-16', updatedAt: '2026-08-16' }

describe('analysis API', () => {
  it('creates a predefined analysis with selected transcript IDs', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: run }), { status: 202 })) as unknown as typeof fetch
    await expect(createAnalysis('meeting_minutes', 'local/model:q4', [2], fetcher)).resolves.toEqual(run)
    expect(fetcher).toHaveBeenCalledWith('/api/analyses', expect.objectContaining({ method: 'POST', body: JSON.stringify({ preset: 'meeting_minutes', model: 'local/model:q4', transcriptionIds: [2] }) }))
  })

  it('lists, reads, and deletes owner-scoped analysis runs', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 })
      return new Response(JSON.stringify(String(input).includes('?') ? { data: [run], pagination: { total: 1 } } : { data: run }), { status: 200 })
    }) as unknown as typeof fetch
    expect((await listAnalyses(fetcher)).pagination.total).toBe(1)
    expect((await getAnalysis(7, fetcher)).id).toBe(7)
    await expect(deleteAnalysis(7, fetcher)).resolves.toBeUndefined()
  })

  it('validates the local DocETL readiness snapshot', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: { status: 'ready', checkedAt: null, latencyMs: 2, version: '0.3.0', reason: null } }), { status: 200 })) as unknown as typeof fetch
    await expect(checkDocetl(fetcher)).resolves.toMatchObject({ status: 'ready', version: '0.3.0' })
  })
})
