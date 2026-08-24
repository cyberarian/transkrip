import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { getCorrectionModel } from '../correction-model'
import { formatCleanTxt } from '../export'
import { Icon } from '../icons'
import { Brand } from './Brand'
import { renameSpeaker, type SpeakerDocument } from '../speaker-document'
import { completeTranscription, deleteTranscription, getTranscription, listTranscriptions, normalizeSpeakerDocument, saveSpeakerDocument, searchTranscriptions, type TranscriptionRecord, type TranscriptionSearchFilters, type TranscriptionSearchResult, type TranscriptionStatus, type TranscriptionSummary } from '../transcriptions-api'
import { taskLedgerRows, taskPreview } from '../task-recovery'

const labels = { processing: 'Diproses', completed: 'Selesai', corrected: 'Dinormalisasi', edited: 'Disunting', error: 'Gagal' }
const languageLabels: Record<string, string> = { id: 'Indonesia', en: 'Inggris', auto: 'Otomatis' }
const taskDate = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const taskTime = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })
type TaskLedgerRow = TranscriptionSummary & Partial<Pick<TranscriptionSearchResult, 'excerpt'>>

export function TasksPage() {
  const [rows, setRows] = useState<TaskLedgerRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [languageFilter, setLanguageFilter] = useState<'' | 'id' | 'en' | 'auto'>('')
  const [statusFilter, setStatusFilter] = useState<'' | TranscriptionStatus>('')
  const [searchMode, setSearchMode] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [document, setDocument] = useState<SpeakerDocument>({ speakers: [], blocks: [] })
  const [partialText, setPartialText] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState<Extract<TranscriptionStatus, 'processing' | 'error'> | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Membaca arsip SQLite lokal…')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const result = await listTranscriptions(); setRows(taskLedgerRows(result.data)); setMessage(`${result.pagination.total} tugas tersimpan di perangkat ini.`) }
    catch (loadError) { const value = loadError instanceof Error ? loadError.message : String(loadError); setMessage(value); setError(value) }
    finally { setLoading(false) }
  }, [])

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault()
    const query = searchQuery.trim()
    if (!query) { setMessage('Masukkan kata yang ingin dicari.'); return }
    setLoading(true); setError(null)
    try {
      const filters: TranscriptionSearchFilters = {}
      if (languageFilter) filters.language = languageFilter
      if (statusFilter) filters.status = statusFilter
      const result = await searchTranscriptions(query, filters)
      setRows(result.data); setSearchMode(true); setOpenId(null)
      setMessage(`${result.pagination.total} hasil lokal untuk “${query}”.`)
    } catch (searchError) {
      const value = searchError instanceof Error ? searchError.message : String(searchError)
      setMessage(value); setError(value)
    } finally { setLoading(false) }
  }

  const clearSearch = async () => {
    setSearchQuery(''); setLanguageFilter(''); setStatusFilter(''); setSearchMode(false); setOpenId(null)
    await load()
  }

  useEffect(() => { let active = true; listTranscriptions().then(result => { if (active) { setRows(taskLedgerRows(result.data)); setMessage(`${result.pagination.total} tugas tersimpan di perangkat ini.`) } }).catch(loadError => { if (active) { const value = loadError instanceof Error ? loadError.message : String(loadError); setMessage(value); setError(value) } }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])

  const updateRecord = (record: TranscriptionRecord) => {
    const summary: TranscriptionSummary = { id: record.id, audioFile: record.audioFile, audioSource: record.audioSource, language: record.language, speakers: record.speakers, diarization: record.diarization, diarizationMode: record.diarizationMode, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt }
    setRows(values => values.map(value => value.id === record.id ? summary : value))
    if (openId === record.id) setDocument({ speakers: record.speakers, blocks: record.formattedTranscript })
  }

  const showRecord = (record: TranscriptionRecord) => {
    const preview = taskPreview(record)
    setOpenId(record.id)
    if (preview.kind === 'recovery') { setPartialText(preview.text); setRecoveryStatus(preview.status); setDocument({ speakers: [], blocks: [] }); updateRecord(record) }
    else { setPartialText(''); setRecoveryStatus(null); setDocument(preview.document); updateRecord(record) }
  }

  const toggle = async (row: TranscriptionSummary) => {
    if (openId === row.id) { setOpenId(null); setRecoveryStatus(null); return }
    setBusyId(row.id)
    try { showRecord(await getTranscription(row.id)) }
    catch (loadError) { setMessage(loadError instanceof Error ? loadError.message : String(loadError)) }
    finally { setBusyId(null) }
  }

  const downloadRecovery = (row: TranscriptionSummary) => {
    const cleanText = formatCleanTxt([{ text: partialText }])
    const url = URL.createObjectURL(new Blob([cleanText], { type: 'text/plain;charset=utf-8' }))
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = `transkrip-${String(row.id).padStart(4, '0')}-parsial.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const markInterrupted = async (row: TranscriptionSummary) => {
    setBusyId(row.id)
    try {
      showRecord(await completeTranscription(row.id, 'error'))
      setMessage(`Tugas #${row.id} ditandai terputus; teks parsial tetap tersimpan dan dapat diunduh.`)
    } catch (markError) { setMessage(markError instanceof Error ? markError.message : String(markError)) }
    finally { setBusyId(null) }
  }

  const remove = async (row: TranscriptionSummary) => {
    if (deleteConfirmId !== row.id) { setDeleteConfirmId(row.id); setMessage(`Tekan sekali lagi untuk menghapus tugas #${row.id} secara permanen.`); return }
    setBusyId(row.id)
    try { await deleteTranscription(row.id); setRows(values => values.filter(value => value.id !== row.id)); setOpenId(null); setDeleteConfirmId(null); setMessage(`Tugas #${row.id} dihapus.`) }
    catch (removeError) { setMessage(removeError instanceof Error ? removeError.message : String(removeError)) }
    finally { setBusyId(null) }
  }

  const refreshProgress = async (row: TranscriptionSummary) => {
    setBusyId(row.id)
    try { showRecord(await getTranscription(row.id)); setMessage(`Progres tugas #${row.id} diperbarui dari SQLite.`) }
    catch (loadError) { setMessage(loadError instanceof Error ? loadError.message : String(loadError)) }
    finally { setBusyId(null) }
  }

  const save = async (row: TranscriptionSummary) => {
    setBusyId(row.id)
    try {
      const cleaned = {
        speakers: document.speakers.map(speaker => ({ ...speaker, label: speaker.label.trim() })),
        blocks: document.blocks.map(block => ({ ...block, speakerLabel: document.speakers.find(speaker => speaker.id === block.speakerId)?.label.trim() || block.speakerLabel })),
      }
      if (cleaned.speakers.some(speaker => !speaker.label)) throw new Error('Nama pembicara tidak boleh kosong.')
      updateRecord(await saveSpeakerDocument(row.id, cleaned)); setMessage(`Dialog tugas #${row.id} disimpan ke SQLite.`)
    }
    catch (saveError) { setMessage(saveError instanceof Error ? saveError.message : String(saveError)) }
    finally { setBusyId(null) }
  }

  const normalize = async (row: TranscriptionSummary) => {
    setBusyId(row.id); setMessage(`Model ${getCorrectionModel()} menormalkan dialog #${row.id} secara lokal…`)
    try { updateRecord(await normalizeSpeakerDocument(row.id, document, getCorrectionModel())); setMessage(`Dialog #${row.id} dinormalisasi dan disimpan.`) }
    catch (normalizeError) { setMessage(normalizeError instanceof Error ? normalizeError.message : String(normalizeError)) }
    finally { setBusyId(null) }
  }

  return <main className="tasks-shell">
    <header className="about-command-bar tasks-command-bar"><Brand href="#workspace" className="about-brand" label="Workspace Transkrip"/><div className="privacy-state"><Icon name="shield"/><span><b>SQLite + diarization lokal</b><small>Audio tidak disimpan permanen</small></span></div><div className="about-location"><span>Menu</span><strong>Tasks</strong></div><a className="about-back" href="#workspace"><Icon name="back"/>Workspace</a></header>
    <section className="tasks-intro"><div><h1>Arsip &amp; proses transkripsi</h1><p>Tugas yang sedang diproses tetap terlihat bersama teks parsial yang sudah masuk SQLite. Setelah selesai, buka dialog per pembicara untuk menyunting, mengganti label, atau menormalkan teks.</p></div><aside><Icon name="shield"/><b>Batas data lokal</b><p>Whisper berjalan di browser. pyannote.audio dan Ollama hanya menerima data melalui loopback; audio sementara dihapus setelah diarization.</p></aside></section>
    <section className="tasks-ledger" aria-labelledby="tasks-title">
      <header><div><h2 id="tasks-title">Daftar tugas lokal</h2><p role="status" aria-live="polite">{message}</p></div><button onClick={() => void (searchMode ? runSearch() : load())} disabled={loading}><Icon name="refresh"/>{loading ? 'Membaca…' : 'Muat ulang'}</button></header>
      <form className="tasks-search" role="search" onSubmit={event => void runSearch(event)}>
        <label className="tasks-search-query"><span>Search transcripts</span><div><Icon name="search"/><input type="search" value={searchQuery} maxLength={200} placeholder="Cari nama file atau isi transkrip" onChange={event => setSearchQuery(event.target.value)}/></div></label>
        <label><span>Filter bahasa</span><select value={languageFilter} onChange={event => setLanguageFilter(event.target.value as typeof languageFilter)}><option value="">Semua bahasa</option><option value="id">Indonesia</option><option value="en">Inggris</option><option value="auto">Otomatis</option></select></label>
        <label><span>Filter status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option value="">Semua status</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="task-search-submit" type="submit" disabled={loading || !searchQuery.trim()}><Icon name="search"/>Search</button>
        {searchMode && <button type="button" onClick={() => void clearSearch()} disabled={loading}>Clear</button>}
      </form>
      {loading && !rows.length ? <div className="tasks-state" role="status">Membaca baris dari SQLite lokal…</div> : error && !rows.length ? <div className="tasks-state tasks-error" role="alert"><strong>Arsip lokal tidak dapat dibaca.</strong><p>{error}</p><button onClick={() => void load()}>Coba lagi</button></div> : rows.length ? <div className="tasks-table-wrap"><table>
        <caption>Daftar tugas transkripsi yang tersimpan untuk akun aktif.</caption>
        <colgroup><col className="task-col-id"/><col className="task-col-audio"/><col className="task-col-language"/><col className="task-col-created"/><col className="task-col-status"/><col className="task-col-actions"/></colgroup>
        <thead><tr><th scope="col">ID</th><th scope="col">Rekaman</th><th scope="col">Bahasa</th><th scope="col">Dibuat</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead>
        <tbody>{rows.map(row => <Fragment key={row.id}><tr className={openId === row.id ? 'open' : undefined}><td data-label="ID"><span className="task-id">#{String(row.id).padStart(4, '0')}</span></td><td data-label="Rekaman"><div className="task-audio-cell"><strong className="task-audio-name" title={row.audioFile}>{row.audioFile}</strong>{row.excerpt && row.excerpt !== row.audioFile && <small className="task-search-excerpt">{row.excerpt}</small>}</div></td><td data-label="Bahasa"><span className="task-language">{languageLabels[row.language] || row.language.toUpperCase()}</span></td><td data-label="Dibuat"><time className="task-created" dateTime={row.createdAt}><span>{taskDate.format(new Date(row.createdAt))}</span><small>{taskTime.format(new Date(row.createdAt))}</small></time></td><td data-label="Status"><div className="task-status-copy"><span className={`task-status status-${row.status}`}>{labels[row.status]}</span><small className="task-status-detail">{row.status === 'processing' ? 'Teks parsial · SQLite' : `${row.speakers.length || 1} pembicara · ${row.diarization === 'local' ? 'pyannote lokal' : 'label default'}`}</small></div></td><td data-label="Tindakan"><div className="task-row-actions"><button aria-expanded={openId === row.id} aria-controls={`editor-${row.id}`} disabled={busyId !== null} onClick={() => void toggle(row)}><Icon name={row.status === 'processing' ? 'refresh' : 'edit'}/><span>{busyId === row.id ? 'Membuka…' : openId === row.id ? 'Tutup' : row.status === 'processing' ? 'Lihat progres' : 'Buka dialog'}</span></button>{row.status !== 'processing' && <a href={`#analysis?source=${row.id}`}><Icon name="analysis"/><span>Analysis</span></a>}<button className={deleteConfirmId === row.id ? 'confirm-delete' : ''} aria-label={deleteConfirmId === row.id ? `Konfirmasi hapus tugas ${row.id}` : `Hapus tugas ${row.id}`} disabled={busyId !== null} onClick={() => void remove(row)}><Icon name="trash"/><span>{deleteConfirmId === row.id ? 'Konfirmasi' : 'Hapus'}</span></button></div></td></tr>
          {openId === row.id && <tr className="task-editor-row"><td className="task-editor-cell" colSpan={6}>{recoveryStatus ? <div id={`editor-${row.id}`} className="processing-preview"><header><div><strong>{recoveryStatus === 'processing' ? 'Sedang diproses atau sesi terputus' : 'Transkripsi terhenti'}</strong><p>{recoveryStatus === 'processing' ? 'Teks berikut sudah tersimpan di SQLite. Muat ulang jika proses masih berjalan, atau tandai terputus untuk menutup tugas tanpa menghapus hasil parsial.' : 'Bagian yang berhasil disimpan sebelum gangguan tetap tersedia sebagai berkas TXT lokal.'}</p></div><div className="recovery-actions"><button onClick={() => downloadRecovery(row)} disabled={!partialText.trim()}><Icon name="download"/>Unduh TXT parsial</button>{recoveryStatus === 'processing' && <><button onClick={() => void refreshProgress(row)} disabled={busyId !== null}><Icon name="refresh"/>{busyId === row.id ? 'Memuat…' : 'Muat ulang progres'}</button><button onClick={() => void markInterrupted(row)} disabled={busyId !== null}><Icon name="close"/>Tandai terputus</button></>}</div></header><textarea aria-label={`Teks parsial tugas ${row.id}`} readOnly value={partialText} rows={Math.max(6, Math.ceil(partialText.length / 90))}/></div> : <div id={`editor-${row.id}`} className="dialogue-editor"><section className="speaker-roster" aria-label="Nama pembicara"><h3>Nama pembicara</h3>{document.speakers.map(speaker => <label key={speaker.id}><span>{speaker.id.replace('SPEAKER_', '#')}</span><input value={speaker.label} maxLength={100} onChange={event => { try { setDocument(value => renameSpeaker(value, speaker.id, event.target.value)) } catch { /* retain the last valid name */ } }}/></label>)}</section><section className="speaker-blocks" aria-label="Dialog per pembicara">{document.blocks.map((block, index) => <article key={block.id}><header><strong>{block.speakerLabel}</strong><span>{block.start.toFixed(1)}–{block.end.toFixed(1)} dtk</span></header><textarea aria-label={`Dialog ${block.speakerLabel}, blok ${index + 1}`} rows={Math.max(3, Math.ceil(block.text.length / 90))} value={block.text} onChange={event => setDocument(value => ({ ...value, blocks: value.blocks.map(item => item.id === block.id ? { ...item, text: event.target.value } : item) }))}/></article>)}</section><footer><span>{document.blocks.length} giliran · {document.speakers.length} pembicara</span><button onClick={() => void normalize(row)} disabled={busyId === row.id}><Icon name="chip"/>Normalisasi bilingual</button><button className="task-save" onClick={() => void save(row)} disabled={busyId === row.id}><Icon name="check"/>{busyId === row.id ? 'Memproses…' : 'Simpan dialog'}</button></footer></div>}</td></tr>}
        </Fragment>)}</tbody></table></div> : <div className="tasks-state"><strong>Belum ada tugas.</strong><p>Jalankan transkripsi di ruang kerja. Tugas selesai akan muncul sebagai dialog per pembicara.</p><a href="#workspace">Buka ruang kerja</a></div>}
    </section>
  </main>
}
