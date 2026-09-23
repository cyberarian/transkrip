import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildAnalysisDocument, groundAnalysisResult } from './analysis-evidence.ts'
const record = { id: 3, audioFile: 'rapat.wav', rawText: 'Raw', correctedText: 'Budi:\nKirim Jumat.', updatedAt: '2026-09-14', formattedTranscript: [{ id: 's1', speakerId: 'p1', speakerLabel: 'Budi', start: 10, end: 15, text: 'Kirim Jumat.' }] }

test('analysis snapshots preserve edited source text and real timestamps', () => {
  const document = buildAnalysisDocument(record)
  assert.match(document.text, /\[\[T3P1\]\]/)
  assert.equal(document.evidence[0].quote, 'Kirim Jumat.')
  assert.equal(document.evidence[0].start, 10)
  record.formattedTranscript[0].text = 'Changed later'
  assert.equal(document.evidence[0].quote, 'Kirim Jumat.')
  record.formattedTranscript[0].text = 'Kirim Jumat.'
})

test('unstructured corrected text never inherits inaccurate timestamps', () => {
  const document = buildAnalysisDocument({ ...record, correctedText: 'New entire corrected transcript' })
  assert.equal(document.evidence[0].start, null)
  assert.equal(document.evidence[0].quote, 'New entire corrected transcript')
})

test('only citations from selected source snapshots can be persisted', () => {
  const document = buildAnalysisDocument(record)
  const result = { summary: 'Kirim Jumat. [[T3P1]]', primary: '', secondary: '', tertiary: '' }
  assert.equal(groundAnalysisResult(result, [document]).evidence?.[0].transcriptionId, 3)
  assert.throws(() => groundAnalysisResult({ ...result, summary: 'Claim [[T9P1]]' }, [document]), /referensi/i)
  assert.equal(groundAnalysisResult({ ...result, summary: 'Uncited' }, [document]).evidence?.length, 0)
})
