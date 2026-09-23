import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { analysisDocx, transcriptDocx } from './docx-export'

describe('DOCX exports', () => {
  it('creates an actual Word document with escaped bilingual text and timestamps', async () => {
    const blob = await transcriptDocx({ title: 'Rapat & interview', source: 'audio.mp4', language: 'id', segments: [{ start: 62, end: 65, text: 'Keputusan <final> & café\nNext step.', speakerLabel: 'Budi' }] })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Keputusan &lt;final&gt; &amp; café')
    expect(xml).toContain('01:02')
    expect(xml).toContain('Budi')
    expect(xml).toContain('Next step.')
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
  })

  it('preserves analysis references as links to the embedded source snapshot', async () => {
    const blob = await analysisDocx({ id: 1, preset: 'meeting_minutes', sourceNames: ['a.wav'], model: 'local', createdAt: '2026-09-14', result: { summary: 'Keputusan [[T2P1]]', primary: '', secondary: '', tertiary: '', evidence: [{ ref: 'T2P1', transcriptionId: 2, source: 'a.wav', blockId: 's1', start: 5, end: 8, quote: 'Setuju.', sourceUpdatedAt: '2026-09-14' }] } })
    const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string')
    expect(xml).toContain('w:anchor="T2P1"')
    expect(xml).toContain('w:name="T2P1"')
    expect(xml).toContain('Setuju.')
    expect(xml).toContain('00:05')
  })
})
