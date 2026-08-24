import type { DiarizationHealthSnapshot, DiarizationMode } from '../diarization-mode'
import { Icon } from '../icons'

const choices: Array<{ mode: DiarizationMode; name: string; verdict: string; description: string }> = [
  { mode: 'auto', name: 'Auto', verdict: 'Direkomendasikan', description: 'Gunakan pyannote hanya setelah layanan lokal dinyatakan siap. Jika tidak, lanjutkan dengan satu label pembicara.' },
  { mode: 'required', name: 'Required', verdict: 'Pekerjaan kritis', description: 'Jangan mulai jika layanan pembicara belum siap. Kegagalan setelah proses dimulai tetap mempertahankan transkrip.' },
  { mode: 'off', name: 'Off', verdict: 'Tanpa WAV sementara', description: 'Jangan membuat atau mengirim WAV ke sidecar. Cocok untuk dikte dan perangkat dengan sumber daya terbatas.' },
]

function readinessCopy(health: DiarizationHealthSnapshot) {
  if (health.status === 'checking') return 'Memeriksa pyannote lokal…'
  if (health.status === 'ready') return `Siap di loopback${health.latencyMs === null ? '' : ` · ${health.latencyMs} ms`}`
  return 'Belum tersedia · transkripsi tetap dapat memakai Auto atau Off'
}

export function DiarizationSettings({ selected, health, checking, onChange, onRetry }: {
  selected: DiarizationMode
  health: DiarizationHealthSnapshot
  checking: boolean
  onChange: (mode: DiarizationMode) => void
  onRetry: () => void
}) {
  return <section className="diarization-workbench" aria-labelledby="diarization-settings-title">
    <header>
      <div><h2 id="diarization-settings-title">Pemisahan pembicara</h2><p role="status" aria-live="polite">{readinessCopy(health)}</p></div>
      <button type="button" onClick={onRetry} disabled={checking}><Icon name="refresh"/>{checking ? 'Memeriksa…' : 'Periksa layanan'}</button>
    </header>
    <fieldset className="diarization-ledger">
      <legend>Pilih perilaku default untuk akun ini</legend>
      {choices.map((choice, index) => <label className={selected === choice.mode ? 'selected' : ''} key={choice.mode}>
        <input type="radio" name="diarization-mode" value={choice.mode} checked={selected === choice.mode} onChange={() => onChange(choice.mode)}/>
        <span className="model-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="selection-mark" aria-hidden="true">{selected === choice.mode ? <Icon name="check"/> : null}</span>
        <span className="diarization-copy"><b>{choice.name}</b><small>{choice.description}</small></span>
        <span className="diarization-verdict">{selected === choice.mode ? `Dipilih · ${choice.verdict}` : choice.verdict}</span>
      </label>)}
    </fieldset>
  </section>
}
