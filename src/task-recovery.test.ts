import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { taskLedgerRows, taskPreview } from './task-recovery'
import type { TranscriptionRecord, TranscriptionSummary } from './transcriptions-api'

const processing = { id: 7, status: 'processing' } as TranscriptionSummary
const completed = { id: 6, status: 'completed' } as TranscriptionSummary
const tasksSource = readFileSync(new URL('./components/TasksPage.tsx', import.meta.url), 'utf8')

describe('processing transcription recovery', () => {
  it('keeps processing tasks visible in the local ledger', () => {
    expect(taskLedgerRows([processing, completed])).toEqual([processing, completed])
  })

  it('returns SQLite-saved partial text as a read-only preview', () => {
    const record = { ...processing, rawText: 'Bagian pertama.\n\nBagian kedua.' } as TranscriptionRecord
    expect(taskPreview(record)).toEqual({ kind: 'recovery', status: 'processing', text: 'Bagian pertama.\n\nBagian kedua.' })
  })

  it('explains when processing started but no segment is saved yet', () => {
    const record = { ...processing, rawText: '' } as TranscriptionRecord
    expect(taskPreview(record)).toEqual({ kind: 'recovery', status: 'processing', text: 'Belum ada bagian teks yang tersimpan.' })
  })

  it('recovers raw text from a failed task when no formatted dialogue exists', () => {
    const record = { ...processing, status: 'error', rawText: 'Teks yang selamat.', formattedTranscript: [] } as unknown as TranscriptionRecord
    expect(taskPreview(record)).toEqual({ kind: 'recovery', status: 'error', text: 'Teks yang selamat.' })
  })

  it('prefers a formatted document when a failed task already has one', () => {
    const block = { id: 'block-1', speakerId: 'SPEAKER_00', speakerLabel: 'Pembicara 1', start: 0, end: 1, text: 'Utuh.' }
    const record = { ...processing, status: 'error', rawText: 'Mentah.', speakers: [], formattedTranscript: [block] } as unknown as TranscriptionRecord
    expect(taskPreview(record)).toEqual({ kind: 'document', document: { speakers: [], blocks: [block] } })
  })

  it('wires processing rows and progress refresh into the Tasks page', () => {
    expect(tasksSource).toContain('setRows(taskLedgerRows(result.data))')
    expect(tasksSource).toContain('taskPreview(record)')
    expect(tasksSource).toContain('Muat ulang progres')
    expect(tasksSource).not.toContain("filter(row => row.status !== 'processing')")
  })
})
