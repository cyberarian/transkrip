import { describe, expect, it } from 'vitest'
import { buildCorrectionMessages, CORRECTION_MODEL, isConservativeEdit, readResponseTextWithinLimit, restoreUnsafeWordChanges } from './correction'

describe('Sahabat-AI correction contract', () => {
  it('uses the requested immutable local model tag', () => {
    expect(CORRECTION_MODEL).toBe('csalab/sahabatai1:llama3_base_Q4_K_M')
    expect(CORRECTION_MODEL).not.toContain(':latest')
  })

  it('gives the base model a narrow Indonesian proofreading task with delimited input', () => {
    const messages = buildCorrectionMessages('Nama Produk harus tetap.  Totalnya 10 unit.')
    const prompt = messages.map(message => message.content).join('\n')

    expect(messages.at(-1)?.content).toBe('{"text":"Nama Produk harus tetap.  Totalnya 10 unit."}')
    expect(prompt).toContain('ejaan Bahasa Indonesia')
    expect(prompt).toContain('receive laporan')
    expect(prompt).toContain('Jangan menerjemahkan')
    expect(prompt).toContain('nama diri')
    expect(prompt).toContain('{"corrected":"teks hasil"}')
  })
})

describe('readResponseTextWithinLimit', () => {
  it('returns a response body that stays within the character limit', async () => {
    const response = new Response('local response')

    await expect(readResponseTextWithinLimit(response, 20)).resolves.toBe('local response')
  })

  it('cancels a streamed response as soon as it exceeds the character limit', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('12345'))
        controller.enqueue(encoder.encode('67890'))
      },
      cancel() {
        cancelled = true
      },
    })
    const response = { body } as Response

    await expect(readResponseTextWithinLimit(response, 8)).rejects.toThrow('Respons Ollama melebihi batas aman.')
    expect(cancelled).toBe(true)
  })
})

describe('isConservativeEdit', () => {
  it('rejects edits to pathological word lengths before expensive comparison', () => {
    const original = 'a'.repeat(1_000)
    const candidate = `${'a'.repeat(999)}b`

    expect(isConservativeEdit(original, candidate)).toBe(false)
  })
})

describe('restoreUnsafeWordChanges', () => {
  it('keeps typo-level corrections but restores a translated mixed-language word', () => {
    expect(restoreUnsafeWordChanges(
      'Silahkan cek aktifitas tim, lalu recieve laporan.',
      'Silakan cek aktivitas tim, lalu terima laporan.',
    )).toBe('Silakan cek aktivitas tim, lalu recieve laporan.')
  })

  it('returns the original when the model changes the word structure', () => {
    expect(restoreUnsafeWordChanges('Tetap sama.', 'Harus tetap sama.')).toBe('Tetap sama.')
  })
})
