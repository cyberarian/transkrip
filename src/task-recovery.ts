import type { TranscriptionRecord, TranscriptionSummary } from './transcriptions-api'

export function taskLedgerRows(rows: TranscriptionSummary[]) {
  return rows
}

export function taskPreview(record: TranscriptionRecord) {
  if (record.status === 'processing') {
    return { kind: 'recovery' as const, status: record.status, text: record.rawText.trim() || 'Belum ada bagian teks yang tersimpan.' }
  }
  if (record.status === 'error' && record.formattedTranscript.length === 0) {
    return { kind: 'recovery' as const, status: record.status, text: record.rawText.trim() || 'Tidak ada bagian teks yang sempat tersimpan.' }
  }
  return { kind: 'document' as const, document: { speakers: record.speakers, blocks: record.formattedTranscript } }
}
