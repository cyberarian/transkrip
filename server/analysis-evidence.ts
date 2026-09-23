import { analysisResultFromUnknown, type AnalysisEvidence, type AnalysisResult } from '../src/analysis.ts'
import type { SpeakerBlock } from '../src/speaker-document.ts'
import type { AnalysisDocument } from './docetl-client.ts'

type Source = { id: number; audioFile: string; rawText: string; correctedText: string | null; updatedAt: string; formattedTranscript: SpeakerBlock[] }
export type EvidenceDocument = AnalysisDocument & { evidence: AnalysisEvidence[] }

export function buildAnalysisDocument(record: Source): EvidenceDocument {
  const formatted = record.formattedTranscript.map(block => `${block.speakerLabel}:\n${block.text}`).join('\n\n')
  const text = (record.correctedText || record.rawText).trim()
  // Whole-transcript corrections can diverge from speaker blocks. Never attach
  // timestamps to rewritten text unless it is still the saved speaker document.
  const timed = formatted.trim() === text
  const passages = timed ? record.formattedTranscript : [{ id: null, start: null, end: null, text }]
  const evidence: AnalysisEvidence[] = []
  for (const passage of passages) {
    for (let offset = 0; offset < passage.text.length; offset += 2000) {
      const quote = passage.text.slice(offset, offset + 2000).trim()
      if (!quote) continue
      evidence.push({ ref: `T${record.id}P${evidence.length + 1}`, transcriptionId: record.id, source: record.audioFile,
        blockId: passage.id, start: passage.start, end: passage.end, quote, sourceUpdatedAt: record.updatedAt })
    }
  }
  return { id: record.id, source: record.audioFile, text: evidence.map(item => `[[${item.ref}]]\n${item.quote}`).join('\n\n'), evidence }
}

export function groundAnalysisResult(value: AnalysisResult, documents: EvidenceDocument[]): AnalysisResult {
  const result = analysisResultFromUnknown(value)
  const available = new Map(documents.flatMap(document => document.evidence).map(item => [item.ref, item]))
  const references = new Set([...`${result.summary}\n${result.primary}\n${result.secondary}\n${result.tertiary}`.matchAll(/\[\[(T\d+P\d+)\]\]/g)].map(match => match[1]))
  if (references.size > 64 || [...references].some(ref => !available.has(ref))) throw new Error('Referensi analisis tidak valid.')
  // Ignore evidence supplied by the model: only the authorized input snapshot
  // may supply quotations, timestamps, filenames, or source IDs.
  return { summary: result.summary, primary: result.primary, secondary: result.secondary, tertiary: result.tertiary,
    evidence: [...references].map(ref => ({ ...available.get(ref)! })) }
}
