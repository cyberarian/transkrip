import { useState } from 'react'
import { analysisPreset, type AnalysisRun } from '../analysis'
import { formatTime } from '../audio'

export function AnalysisResultView({ run }: { run: AnalysisRun }) {
  const [selected, setSelected] = useState<string | null>(null)
  const result = run.result!
  const evidence = result.evidence ?? []
  const source = evidence.find(item => item.ref === selected)
  const titles = ['Ringkasan', ...analysisPreset(run.preset).sections]
  const texts = [result.summary, result.primary, result.secondary, result.tertiary]
  const review = (ref: string) => {
    setSelected(ref)
    requestAnimationFrame(() => document.getElementById(`evidence-${run.id}`)?.focus())
  }
  return <div className="analysis-result">
    {texts.map((text, index) => <section key={titles[index]}><h4>{titles[index]}</h4><p>{text ? text.split(/(\[\[T\d+P\d+\]\])/g).map((part, partIndex) => {
      const reference = evidence.find(item => `[[${item.ref}]]` === part)
      return reference ? <button type="button" className="evidence-link" key={partIndex} onClick={() => review(reference.ref)} aria-label={`Periksa sumber ${reference.source}, ${reference.start === null ? 'waktu tidak tersedia' : formatTime(reference.start)}`}>{reference.ref}</button> : part
    }) : 'Tidak ditemukan dalam transkrip.'}</p>{text && evidence.length > 0 && !evidence.some(item => text.includes(`[[${item.ref}]]`)) && <small>Bagian ini belum menyertakan referensi petikan; periksa transkrip sumber.</small>}</section>)}
    <section className="analysis-evidence" aria-label="Bukti transkrip">
      <h4>Periksa sumber</h4>
      <p>{evidence.length ? 'Pilih penanda pada hasil untuk memeriksa petikan sumber yang digunakan saat analisis dibuat.' : 'Hasil ini belum memiliki referensi petikan. Periksa transkrip sumber atau jalankan analisis baru.'}</p>
      {source && <div id={`evidence-${run.id}`} tabIndex={-1} className="evidence-passage">
        <strong>{source.source} · {source.ref}</strong>
        <p>{source.start === null ? 'Waktu tidak tersedia untuk teks ini.' : `${formatTime(source.start)}–${formatTime(source.end!)} · rentang petikan sumber`}</p>
        <blockquote>{source.quote}</blockquote>
        <small>Salinan saat analisis dibuat · versi sumber {source.sourceUpdatedAt}. Perubahan transkrip berikutnya tidak mengubah petikan ini.</small>
      </div>}
    </section>
  </div>
}
