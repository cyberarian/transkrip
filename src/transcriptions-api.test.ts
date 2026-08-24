import { describe, expect, it, vi } from 'vitest'
import { appendTranscriptionSegment, checkDiarizationReadiness, createTranscription, getTranscription, saveTranscription, searchTranscriptions } from './transcriptions-api'

const row = {
  id: 12,
  audioFile: 'rapat.wav',
  audioSource: 'rapat.wav',
  language: 'id',
  rawTranscript: 'Teks mentah.',
  rawText: 'Teks mentah.',
  formattedTranscript: [],
  correctedText: null,
  speakers: [],
  diarization: 'pending' as const,
  diarizationMode: 'auto' as const,
  status: 'processing' as const,
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
}

describe('transcription API client', () => {
  it('creates a local task with a bounded JSON request', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: row }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    await expect(createTranscription('rapat.wav', 'id', fetcher)).resolves.toEqual(row)
    expect(fetcher).toHaveBeenCalledWith('/api/transcriptions', expect.objectContaining({ method: 'POST', body: '{"audioFile":"rapat.wav","language":"id"}' }))
  })

  it('sends an explicit per-task diarization override', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ...row, diarizationMode: 'off' } }), { status: 201 }))

    await createTranscription('dictation.wav', 'id', fetcher, 'off')
    expect(fetcher).toHaveBeenCalledWith('/api/transcriptions', expect.objectContaining({ body: '{"audioFile":"dictation.wav","language":"id","diarizationMode":"off"}' }))
  })

  it('checks local diarization readiness before audio upload', async () => {
    const ready = { status: 'ready', checkedAt: '2026-08-15T05:30:00.000Z', latencyMs: 4, reason: null }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: ready }), { status: 200 }))

    await expect(checkDiarizationReadiness(fetcher)).resolves.toEqual(ready)
    expect(fetcher).toHaveBeenCalledWith('/api/runtime/diarization', expect.objectContaining({ method: 'POST', body: '{}' }))
  })

  it('appends each incoming segment to the selected task', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: row }), { headers: { 'Content-Type': 'application/json' } }))

    await appendTranscriptionSegment(12, 'Teks mentah.', fetcher)
    expect(fetcher).toHaveBeenCalledWith('/api/transcriptions/12/segments', expect.objectContaining({ method: 'POST', body: '{"text":"Teks mentah."}' }))
  })

  it('surfaces the API error and never treats an error document as a row', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Teks terlalu panjang.' } }), { status: 413, headers: { 'Content-Type': 'application/json' } }))

    await expect(saveTranscription(12, 'x', fetcher)).rejects.toThrow('Teks terlalu panjang.')
  })

  it('accepts a valid full row near the database text limit', async () => {
    const largeRow = { ...row, rawText: 'a'.repeat(1_000_000), correctedText: 'b'.repeat(1_000_000) }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: largeRow }), { headers: { 'Content-Type': 'application/json' } }))

    await expect(getTranscription(12, fetcher)).resolves.toEqual(largeRow)
  })

  it('searches the local archive with encoded bounded filters', async () => {
    const result = { data: [{ ...row, excerpt: 'Rapat produk hari Senin.' }], pagination: { limit: 50, offset: 0, total: 1 } }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))

    await expect(searchTranscriptions('rapat produk', { language: 'id', status: 'completed' }, fetcher)).resolves.toEqual(result)
    expect(fetcher).toHaveBeenCalledWith('/api/transcriptions?q=rapat+produk&language=id&status=completed&limit=50&offset=0', expect.objectContaining({ headers: { Accept: 'application/json' } }))
  })

  it('rejects an empty or oversized search before sending a request', async () => {
    const fetcher = vi.fn()
    await expect(searchTranscriptions('   ', {}, fetcher)).rejects.toThrow('Kata pencarian')
    await expect(searchTranscriptions('a'.repeat(201), {}, fetcher)).rejects.toThrow('Kata pencarian')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
