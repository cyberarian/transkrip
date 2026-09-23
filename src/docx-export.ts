import { Bookmark, Document, HeadingLevel, InternalHyperlink, Packer, Paragraph, TextRun } from 'docx'
import { analysisPreset, type AnalysisRun } from './analysis'
import { formatTime } from './audio'

function clean(text: string) {
  return text.replace(/\p{Cc}/gu, character => ['\n', '\r', '\t'].includes(character) ? character : '')
}
function paragraphs(text: string, refs: Set<string> = new Set()) {
  return clean(text).split(/\r?\n/).map(line => new Paragraph({ children: line.split(/(\[\[T\d+P\d+\]\])/g).map(part => {
    const ref = part.slice(2, -2)
    return refs.has(ref) && part === `[[${ref}]]` ? new InternalHyperlink({ anchor: ref, children: [new TextRun({ text: ref, style: 'Hyperlink' })] }) : new TextRun(part)
  }), spacing: { after: 120 } }))
}
function heading(text: string) { return new Paragraph({ text: clean(text), heading: HeadingLevel.HEADING_1 }) }
function pack(title: string, children: Paragraph[]) {
  return Packer.toBlob(new Document({ title: clean(title), creator: 'Transkrip', description: 'Dokumen diekspor secara lokal dari Transkrip.',
    sections: [{ children: [new Paragraph({ text: clean(title), heading: HeadingLevel.TITLE }), ...children] }] }))
}

export function transcriptDocx(input: { title: string; source: string; language: string; segments: { text: string; start?: number; end?: number; speakerLabel?: string }[] }) {
  return pack(input.title, [...paragraphs(`Sumber: ${input.source}\nBahasa: ${input.language}`), ...input.segments.flatMap(segment => [
    new Paragraph({ children: [new TextRun({ text: clean([segment.speakerLabel, segment.start !== undefined ? `${formatTime(segment.start)}–${formatTime(segment.end ?? segment.start)}` : null].filter(Boolean).join(' · ')), bold: true })] }),
    ...paragraphs(segment.text),
  ])])
}

export function analysisDocx(run: Pick<AnalysisRun, 'id' | 'preset' | 'sourceNames' | 'model' | 'createdAt' | 'result'>) {
  if (!run.result) throw new Error('Hasil analisis belum tersedia.')
  const preset = analysisPreset(run.preset)
  const evidence = run.result.evidence ?? []
  const refs = new Set(evidence.map(item => item.ref))
  return pack(preset.title, [
    ...paragraphs(`Draf analisis #${run.id}\nSumber: ${run.sourceNames.join(', ')}\nDibuat: ${run.createdAt}\nModel: ${run.model}`),
    ...['Ringkasan', ...preset.sections].flatMap((title, index) => [heading(title), ...paragraphs([run.result!.summary, run.result!.primary, run.result!.secondary, run.result!.tertiary][index] || 'Tidak ditemukan dalam transkrip.', refs)]),
    heading('Petikan sumber'),
    ...(!evidence.length ? paragraphs('Hasil ini belum memiliki referensi petikan.') : evidence.flatMap(item => [
      new Paragraph({ children: [new Bookmark({ id: item.ref, children: [new TextRun({ text: `${item.ref} · ${clean(item.source)}`, bold: true })] })] }),
      ...paragraphs(`${item.start === null ? 'Waktu tidak tersedia' : `${formatTime(item.start)}–${formatTime(item.end!)}`}\nVersi sumber: ${item.sourceUpdatedAt}\n${item.quote}`),
    ])),
  ])
}

export function saveDocx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
