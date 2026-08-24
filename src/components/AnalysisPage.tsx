import { useCallback, useEffect, useMemo, useState } from 'react'
import { ANALYSIS_PRESETS, analysisActivity, analysisPreset, type AnalysisPreset, type AnalysisRun } from '../analysis'
import { checkDocetl, createAnalysis, deleteAnalysis, listAnalyses, type DocetlRuntimeStatus } from '../analysis-api'
import { getAnalysisModel, saveAnalysisModel } from '../analysis-model'
import { Icon } from '../icons'
import { listLocalOllamaModels, type LocalOllamaModel } from '../ollama-models'
import { listTranscriptions, type TranscriptionSummary } from '../transcriptions-api'
import { Brand } from './Brand'

const statusLabels = { pending: 'Menunggu', running: 'Berjalan', completed: 'Selesai', error: 'Gagal' }
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
const initialHealth: DocetlRuntimeStatus = { status: 'checking', checkedAt: null, latencyMs: null, version: null, reason: null }

function sourceFromHash() {
  if (typeof window === 'undefined') return null
  const query = window.location.hash.split('?')[1]
  const value = Number(new URLSearchParams(query || '').get('source'))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

function download(run: AnalysisRun, format: 'txt' | 'markdown' | 'json') {
  if (!run.result) return
  const preset = analysisPreset(run.preset)
  const sections = preset.sections.map((title, index) => ({ title, content: [run.result!.primary, run.result!.secondary, run.result!.tertiary][index] || 'Tidak ditemukan.' }))
  const content = format === 'json'
    ? JSON.stringify({ preset: run.preset, model: run.model, sources: run.sourceNames, result: run.result }, null, 2)
    : [`${preset.title}`, '', `Sumber: ${run.sourceNames.join(', ')}`, `Model: ${run.model}`, '', 'Ringkasan', run.result.summary, ...sections.flatMap(section => ['', section.title, section.content])].map(line => format === 'markdown' && ['Ringkasan', ...preset.sections].includes(line) ? `## ${line}` : line).join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `analysis-${run.id}.${format === 'markdown' ? 'md' : format}`; anchor.click(); URL.revokeObjectURL(url)
}

function AnalysisLiveActivity({ run, now }: { run: AnalysisRun; now: number }) {
  const activity = analysisActivity(run, now)
  return <div className="analysis-run-state analysis-live-activity" role="status" aria-live="polite">
    <div className="analysis-live-heading"><Icon name="analysis"/><strong>{activity.phase}</strong><time>{activity.elapsed}</time></div>
    <div className="analysis-progress-track" role="progressbar" aria-label="Analisis lokal sedang berjalan" aria-valuetext={activity.phase}><span/></div>
    <p>{activity.detail}</p>
    <small>Status diperbarui otomatis setiap 2 detik. Anda boleh berpindah menu; pekerjaan tersimpan di SQLite.</small>
  </div>
}

export function AnalysisPage() {
  const [tasks, setTasks] = useState<TranscriptionSummary[]>([])
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [models, setModels] = useState<LocalOllamaModel[]>([])
  const [selected, setSelected] = useState<number[]>(() => { const id = sourceFromHash(); return id ? [id] : [] })
  const [preset, setPreset] = useState<AnalysisPreset>('meeting_minutes')
  const [model, setModel] = useState(() => getAnalysisModel())
  const [health, setHealth] = useState<DocetlRuntimeStatus>(initialHealth)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Membaca tugas dan hasil analisis lokal…')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [clock, setClock] = useState(() => Date.now())

  const refreshRuns = useCallback(async () => {
    const result = await listAnalyses(); setRuns(result.data)
    return result
  }, [])

  useEffect(() => {
    let active = true
    const savedModel = getAnalysisModel()
    Promise.all([listTranscriptions(), listAnalyses(), listLocalOllamaModels(), checkDocetl()]).then(([taskResult, runResult, modelResult, healthResult]) => {
      if (!active) return
      setTasks(taskResult.data.filter(task => task.status !== 'processing'))
      setRuns(runResult.data); setModels(modelResult); setHealth(healthResult)
      if (!modelResult.some(item => item.name === savedModel) && modelResult[0]) setModel(modelResult[0].name)
      setMessage(`${taskResult.data.length} tugas · ${runResult.pagination.total} analisis tersimpan pada akun ini.`)
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : String(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!runs.some(run => run.status === 'pending' || run.status === 'running')) return
    const timer = window.setInterval(() => { void refreshRuns().catch(() => undefined) }, 2_000)
    return () => window.clearInterval(timer)
  }, [refreshRuns, runs])

  const activeRun = useMemo(() => runs.find(run => run.status === 'pending' || run.status === 'running') ?? null, [runs])
  const hasActiveRun = activeRun !== null
  useEffect(() => {
    if (!hasActiveRun) return
    const timer = window.setInterval(() => setClock(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [hasActiveRun])

  const selectedTasks = useMemo(() => tasks.filter(task => selected.includes(task.id)), [selected, tasks])
  const activeActivity = activeRun ? analysisActivity(activeRun, clock) : null
  const toggle = (id: number) => setSelected(value => value.includes(id) ? value.filter(item => item !== id) : value.length < 8 ? [...value, id] : value)

  const run = async () => {
    if (!selected.length || busy) return
    setBusy(true); setMessage('Memeriksa DocETL dan Ollama pada loopback lokal…')
    try {
      const ready = await checkDocetl(); setHealth(ready)
      if (ready.status !== 'ready') throw new Error(ready.reason === 'dependency_missing' ? 'DocETL belum terpasang. Ikuti petunjuk instalasi lokal di README.' : 'Layanan DocETL belum siap. Jalankan worker lokal lalu coba lagi.')
      saveAnalysisModel(model)
      const created = await createAnalysis(preset, model, selected)
      setRuns(value => [created, ...value]); setMessage(`Analisis #${created.id} masuk antrean lokal. Anda dapat berpindah halaman tanpa menghentikan pekerjaan.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const remove = async (runValue: AnalysisRun) => {
    if (deleteConfirm !== runValue.id) { setDeleteConfirm(runValue.id); setMessage(`Pilih Hapus lagi untuk menghapus analisis #${runValue.id}.`); return }
    setBusy(true)
    try { await deleteAnalysis(runValue.id); setRuns(value => value.filter(item => item.id !== runValue.id)); setDeleteConfirm(null); setMessage(`Analisis #${runValue.id} dihapus dari SQLite.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const healthCopy = health.status === 'ready' ? `DocETL ${health.version} siap` : health.status === 'checking' ? 'Memeriksa DocETL…' : health.reason === 'dependency_missing' ? 'Paket DocETL belum terpasang' : 'Worker DocETL belum terhubung'

  return <main className="analysis-shell">
    <header className="about-command-bar analysis-command-bar"><Brand href="#workspace" className="about-brand" label="Workspace Transkrip"/><div className="privacy-state"><Icon name="shield"/><span><b>DocETL + Ollama lokal</b><small>Tanpa penyedia model cloud</small></span></div><div className="about-location"><span>Menu</span><strong>Analysis</strong></div><a className="about-back" href="#workspace"><Icon name="back"/>Workspace</a></header>
    <section className="analysis-intro"><div><h1>Analisis percakapan lokal</h1><p>Pilih transkrip yang sudah selesai, lalu jalankan pipeline terarah untuk merangkum keputusan, tindakan, dan tema tanpa memberi DocETL akses langsung ke SQLite.</p></div><aside className={`analysis-health is-${health.status}`}><Icon name="analysis"/><strong>{healthCopy}</strong><p>{health.status === 'ready' ? 'Pekerjaan berjalan satu per satu agar sesuai dengan perangkat 16 GB.' : 'Fitur transkripsi tetap berfungsi meskipun layanan analisis opsional belum siap.'}</p><button type="button" onClick={() => void checkDocetl().then(setHealth)} disabled={health.status === 'checking'}>Check again</button></aside></section>
    <section className="analysis-builder" aria-labelledby="analysis-builder-title">
      <header><div><h2 id="analysis-builder-title">Siapkan pipeline</h2><p role="status" aria-live="polite">{message}</p></div><span>{selected.length}/8 dipilih</span></header>
      <div className="analysis-builder-grid">
        <fieldset className="analysis-presets"><legend>Pilih hasil</legend>{ANALYSIS_PRESETS.map(option => <label key={option.id} className={preset === option.id ? 'selected' : ''}><input type="radio" name="analysis-preset" checked={preset === option.id} onChange={() => setPreset(option.id)}/><span><strong>{option.title}</strong><small>{option.description}</small></span><b>{preset === option.id ? 'Dipilih' : 'Pilih'}</b></label>)}</fieldset>
        <div className="analysis-sources"><h3>Pilih transkrip</h3>{loading ? <p className="analysis-empty">Membaca arsip lokal…</p> : tasks.length ? tasks.map(task => <label key={task.id} className={selected.includes(task.id) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(task.id)} disabled={!selected.includes(task.id) && selected.length >= 8} onChange={() => toggle(task.id)}/><span><strong>{task.audioFile}</strong><small>#{String(task.id).padStart(4, '0')} · {task.language.toUpperCase()} · {task.speakers.length || 1} pembicara</small></span><b>{selected.includes(task.id) ? 'Dipilih' : 'Pilih'}</b></label>) : <p className="analysis-empty">Belum ada transkrip selesai. Selesaikan satu tugas dari Workspace terlebih dahulu.</p>}</div>
      </div>
      <footer><label><span>Model analisis</span><select value={model} onChange={event => setModel(event.target.value)}>{!models.some(item => item.name === model) && <option value={model}>{model}</option>}{models.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label><div><span className={activeActivity ? 'analysis-builder-activity' : undefined} role={activeActivity ? 'status' : undefined} aria-live={activeActivity ? 'polite' : undefined}>{activeActivity ? <><b>{activeActivity.phase}</b><small>Analisis #{activeRun!.id} · {activeActivity.elapsed}</small></> : selectedTasks.map(task => task.audioFile).join(', ') || 'Belum ada sumber dipilih'}</span><button type="button" onClick={() => void run()} disabled={busy || !selected.length || health.status !== 'ready'}><Icon name="analysis"/>{busy ? 'Menyiapkan…' : 'Run analysis'}</button></div></footer>
    </section>
    <section className="analysis-history" aria-labelledby="analysis-history-title"><header><div><h2 id="analysis-history-title">Hasil tersimpan</h2><p>Setiap hasil terpisah dari transkrip sumber dan hanya terlihat oleh pemilik akun.</p></div><button type="button" onClick={() => void refreshRuns()} disabled={loading}><Icon name="refresh"/>Refresh</button></header>
      {runs.length ? <div className="analysis-run-list">{runs.map(runValue => {
        const definition = analysisPreset(runValue.preset)
        const isActive = runValue.status === 'pending' || runValue.status === 'running'
        const activity = isActive ? analysisActivity(runValue, clock) : null
        return <article key={runValue.id} className={`analysis-run is-${runValue.status}`}>
          <header><span><b>#{String(runValue.id).padStart(4, '0')}</b><small>{dateTime.format(new Date(runValue.createdAt))}</small></span><div><h3>{definition.title}</h3><p>{runValue.sourceNames.join(' · ')}</p></div><strong>{statusLabels[runValue.status]}{activity && <small>{activity.elapsed}</small>}</strong></header>
          {runValue.result ? <div className="analysis-result"><section><h4>Ringkasan</h4><p>{runValue.result.summary}</p></section>{definition.sections.map((title, index) => <section key={title}><h4>{title}</h4><p>{[runValue.result!.primary, runValue.result!.secondary, runValue.result!.tertiary][index] || 'Tidak ditemukan dalam transkrip.'}</p></section>)}</div> : isActive ? <AnalysisLiveActivity run={runValue} now={clock}/> : <p className="analysis-run-state">{runValue.errorMessage || 'Analisis tidak menghasilkan keluaran.'}</p>}
          <footer><span>{runValue.model}</span>{runValue.result && <><button onClick={() => download(runValue, 'txt')}><Icon name="download"/>TXT</button><button onClick={() => download(runValue, 'markdown')}><Icon name="download"/>Markdown</button><button onClick={() => download(runValue, 'json')}><Icon name="download"/>JSON</button></>}<button className={deleteConfirm === runValue.id ? 'confirm-delete' : ''} onClick={() => void remove(runValue)} disabled={busy || runValue.status === 'running'}><Icon name="trash"/>{deleteConfirm === runValue.id ? 'Konfirmasi' : 'Hapus'}</button></footer>
        </article>
      })}</div> : <div className="analysis-empty"><strong>Belum ada hasil analisis.</strong><p>Pilih satu hingga delapan transkrip, tentukan pipeline, lalu jalankan pekerjaan lokal pertama.</p></div>}
    </section>
  </main>
}
