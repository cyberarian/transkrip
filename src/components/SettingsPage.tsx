import { useEffect, useState } from 'react'
import { DEFAULT_CORRECTION_MODEL, getCorrectionModel, saveCorrectionModel } from '../correction-model'
import { Icon } from '../icons'
import { Brand } from './Brand'
import { listLocalOllamaModels, type LocalOllamaModel } from '../ollama-models'
import { AppearanceSettings } from './AppearanceSettings'
import { DiarizationSettings } from './DiarizationSettings'
import { checkDiarizationReadiness } from '../transcriptions-api'
import { updateDiarizationPreference, type SessionUser } from '../auth-api'
import type { DiarizationHealthSnapshot, DiarizationMode } from '../diarization-mode'

type LoadState = 'loading' | 'ready' | 'error'

function formatModelSize(bytes: number | null) {
  if (bytes === null) return 'Ukuran tidak dilaporkan'
  return new Intl.NumberFormat('id-ID', { style: 'unit', unit: 'gigabyte', unitDisplay: 'short', maximumFractionDigits: 1 }).format(bytes / 1_000_000_000)
}

const initialDiarizationHealth: DiarizationHealthSnapshot = { status: 'checking', checkedAt: null, latencyMs: null, reason: null }

export function SettingsPage({ user, onUserUpdated }: { user: SessionUser; onUserUpdated: (user: SessionUser) => void }) {
  const [models, setModels] = useState<LocalOllamaModel[]>([])
  const [selected, setSelected] = useState(() => getCorrectionModel())
  const [saved, setSaved] = useState(() => getCorrectionModel())
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [notice, setNotice] = useState('Membaca model yang terpasang dari Ollama lokal…')
  const [reloadKey, setReloadKey] = useState(0)
  const [diarizationMode, setDiarizationMode] = useState<DiarizationMode>(user.diarizationMode)
  const [savedDiarizationMode, setSavedDiarizationMode] = useState<DiarizationMode>(user.diarizationMode)
  const [diarizationHealth, setDiarizationHealth] = useState(initialDiarizationHealth)
  const [checkingDiarization, setCheckingDiarization] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    listLocalOllamaModels(controller.signal).then(result => {
      const current = getCorrectionModel()
      const fallback = result.find(model => model.name === DEFAULT_CORRECTION_MODEL)?.name ?? result[0]?.name ?? current
      setModels(result)
      setSelected(result.some(model => model.name === current) ? current : fallback)
      setSaved(current)
      setLoadState('ready')
      setNotice(result.length ? `${result.length} model tersedia di perangkat ini.` : 'Ollama aktif, tetapi belum ada model yang terpasang.')
    }).catch(error => {
      if (controller.signal.aborted) return
      setLoadState('error')
      setNotice(error instanceof Error ? `${error.message} Pastikan Ollama sedang berjalan, lalu coba lagi.` : 'Ollama lokal tidak dapat dihubungi.')
    })
    return () => controller.abort()
  }, [reloadKey])

  const checkDiarization = () => {
    setCheckingDiarization(true)
    setDiarizationHealth(value => ({ ...value, status: 'checking', reason: null }))
    checkDiarizationReadiness().then(setDiarizationHealth).catch(() => setDiarizationHealth({ status: 'unavailable', checkedAt: new Date().toISOString(), latencyMs: null, reason: 'unreachable' })).finally(() => setCheckingDiarization(false))
  }

  useEffect(() => {
    let active = true
    checkDiarizationReadiness().then(result => { if (active) setDiarizationHealth(result) }).catch(() => { if (active) setDiarizationHealth({ status: 'unavailable', checkedAt: new Date().toISOString(), latencyMs: null, reason: 'unreachable' }) }).finally(() => { if (active) setCheckingDiarization(false) })
    return () => { active = false }
  }, [])

  const reload = () => {
    setLoadState('loading')
    setNotice('Membaca model yang terpasang dari Ollama lokal…')
    setReloadKey(value => value + 1)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (diarizationMode !== savedDiarizationMode) {
        const updated = await updateDiarizationPreference(diarizationMode)
        onUserUpdated(updated)
        setSavedDiarizationMode(updated.diarizationMode)
      }
      if (selected !== saved) { saveCorrectionModel(selected); setSaved(selected) }
      setNotice('Pengaturan model dan diarization tersimpan untuk akun aktif.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Pengaturan tidak dapat disimpan.')
    } finally { setSaving(false) }
  }

  return <main
    className="settings-shell"
    data-design-seed="incumbent-evidence-console/settings-inventory-ledger-v1"
    data-design-contract="THESIS: inspectable local device inventory ledger. OWN-WORLD: inherited sixteen-color evidence console. STORY: inspect, select, save, return. FIRST VIEWPORT: command ledger, privacy scope, active model. FORM: Operate-mode flat workstation ledger. FINISH: review verdict and DESIGN.md."
  >
    <header className="about-command-bar settings-command-bar">
      <Brand href="#workspace" className="about-brand" label="Kembali ke ruang kerja Transkrip"/>
      <div className="privacy-state"><Icon name="shield"/><span><b>Inventaris lokal saja</b><small>Settings tidak mengirim teks transkrip</small></span></div>
      <div className="about-location"><span>Menu</span><strong>Settings</strong></div>
      <a className="about-back" href="#workspace"><Icon name="back"/>Workspace</a>
    </header>

    <section className="settings-intro" aria-labelledby="settings-title">
      <div>
        <h1 id="settings-title">Sesuaikan alat kerja tanpa meninggalkan perangkat.</h1>
        <p>Pilih model Ollama untuk koreksi dan karakter tipografi untuk membaca naskah. Sahabat-AI Llama 3 Base Q4_K_M tetap direkomendasikan untuk Bahasa Indonesia; tampilan tersimpan hanya di browser ini.</p>
      </div>
      <aside><Icon name="shield"/><b>Batas privasi</b><p>Halaman ini hanya meminta inventaris model dari <code>/api/tags</code> melalui loopback. Isi transkrip baru dikirim ke Ollama ketika Anda menekan Koreksi ejaan lokal.</p></aside>
    </section>

    <AppearanceSettings/>

    <DiarizationSettings selected={diarizationMode} health={diarizationHealth} checking={checkingDiarization} onChange={setDiarizationMode} onRetry={checkDiarization}/>

    <section className="settings-workbench" aria-label="Pemilihan model koreksi">
      <header><div><h2>Model terpasang</h2><p role="status" aria-live="polite">{notice}</p></div><button type="button" onClick={reload} disabled={loadState === 'loading'}><Icon name="refresh"/>Muat ulang</button></header>

      {loadState === 'loading' ? <div className="settings-loading" aria-busy="true"><span/><span/><span/></div> : null}
      {loadState === 'error' ? <div className="settings-error"><strong>Ollama belum dapat dibaca.</strong><p>Jalankan Ollama pada perangkat ini. Tidak ada fallback cloud dan pilihan tersimpan tetap dipertahankan.</p><button type="button" onClick={reload}>Coba lagi</button></div> : null}
      {loadState === 'ready' && models.length === 0 ? <div className="settings-empty"><strong>Belum ada model lokal.</strong><p>Pasang model di Ollama, lalu muat ulang daftar ini. Transkrip tidak akan mencoba layanan jarak jauh.</p></div> : null}
      {loadState === 'ready' && models.length > 0 ? <fieldset className="model-ledger">
        <legend>Pilih satu model untuk koreksi typo dan ejaan</legend>
        {models.map((model, index) => {
          const recommended = model.name === DEFAULT_CORRECTION_MODEL
          return <label className={selected === model.name ? 'selected' : ''} key={model.name}>
            <input type="radio" name="correction-model" value={model.name} checked={selected === model.name} onChange={() => setSelected(model.name)}/>
            <span className="model-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="selection-mark" aria-hidden="true">{selected === model.name ? <Icon name="check"/> : null}</span>
            <span className="model-identity"><b>{model.name}</b><small>{[model.family, model.parameterSize, model.quantization].filter(Boolean).join(' · ') || 'Detail arsitektur tidak dilaporkan'}</small></span>
            <span className="model-size">{formatModelSize(model.size)}</span>
            <span className={recommended ? 'recommendation recommended' : 'recommendation'}>{selected === model.name ? recommended ? 'Dipilih · rekomendasi' : 'Dipilih' : recommended ? 'Direkomendasikan' : 'Tersedia'}</span>
          </label>
        })}
      </fieldset> : null}
    </section>

    <footer className="settings-savebar">
      <div><span>Model aktif</span><strong>{saved}</strong></div>
      <div><span>Diarization akun</span><strong>{savedDiarizationMode === 'auto' ? 'Auto' : savedDiarizationMode === 'required' ? 'Required' : 'Off'}</strong></div>
      <button type="button" onClick={() => void save()} disabled={saving || !selected || (selected === saved && diarizationMode === savedDiarizationMode)}><Icon name="check"/>{saving ? 'Menyimpan…' : selected === saved && diarizationMode === savedDiarizationMode ? 'Pilihan tersimpan' : 'Simpan pengaturan'}</button>
    </footer>
  </main>
}
