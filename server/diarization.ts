import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Segment } from '../src/types.ts'
import { alignSpeakers, type SpeakerDocument, type SpeakerTurn } from '../src/speaker-document.ts'

const SIDECAR_URL = 'http://127.0.0.1:8765/diarize'
const MAX_AUDIO_BYTES = 250 * 1024 * 1024

export class AudioStaging {
  readonly directory: string
  constructor(directory: string) {
    this.directory = directory; mkdirSync(directory, { recursive: true, mode: 0o700 })
    for (const entry of readdirSync(directory)) if (/^\d+\.wav$/.test(entry)) { try { unlinkSync(join(directory, entry)) } catch { /* a concurrent process may own it */ } }
  }
  path(id: number) { return join(this.directory, `${id}.wav`) }
  write(id: number, bytes: Buffer) {
    if (bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WAVE') throw new Error('Audio WAV tidak valid.')
    writeFileSync(this.path(id), bytes, { mode: 0o600 })
  }
  remove(id: number) { const path = this.path(id); if (existsSync(path)) unlinkSync(path) }
}

function validTurns(value: unknown): value is SpeakerTurn[] {
  return Array.isArray(value) && value.length <= 20_000 && value.every(turn => turn && typeof turn === 'object'
    && Number.isFinite((turn as SpeakerTurn).start) && Number.isFinite((turn as SpeakerTurn).end)
    && (turn as SpeakerTurn).start >= 0 && (turn as SpeakerTurn).end > (turn as SpeakerTurn).start
    && typeof (turn as SpeakerTurn).speaker === 'string' && (turn as SpeakerTurn).speaker.length <= 100)
}

export async function diarize(staging: AudioStaging, id: number, segments: Segment[], language: string, fetcher: typeof fetch = fetch): Promise<{ document: SpeakerDocument; mode: 'local' | 'fallback' }> {
  const path = staging.path(id)
  try {
    if (!existsSync(path)) return { document: alignSpeakers(segments, [], language), mode: 'fallback' }
    const response = await fetcher(SIDECAR_URL, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: readFileSync(path), signal: AbortSignal.timeout(30 * 60_000) })
    if (!response.ok) throw new Error(`Diarization sidecar responded ${response.status}`)
    const text = await response.text()
    if (text.length > 2_000_000) throw new Error('Diarization response too large')
    const payload = JSON.parse(text) as { turns?: unknown }
    if (!validTurns(payload.turns)) throw new Error('Invalid diarization response')
    return { document: alignSpeakers(segments, payload.turns, language), mode: 'local' }
  } catch {
    return { document: alignSpeakers(segments, [], language), mode: 'fallback' }
  } finally { staging.remove(id) }
}
