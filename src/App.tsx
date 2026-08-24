import { useEffect, useMemo, useRef, useState } from 'react'
import { decodeAudio, formatSrtTime, formatTime, MAX_AUDIO_FILE_BYTES } from './audio'
import { Icon } from './icons'
import { Brand } from './components/Brand'
import type { EngineState, Segment } from './types'
import { Waveform } from './components/Waveform'
import { WhisperEngine } from './whisper'
import { correctTranscriptLocally } from './correction'
import { formatCleanTxt } from './export'
import { appendTranscriptionSegment, checkDiarizationReadiness, completeTranscription, createTranscription, finalizeTranscription, saveTranscription, uploadDiarizationAudio } from './transcriptions-api'
import { encodePcm16Wav } from './wav'
import { awaitPersistence, createPersistenceRun, enqueueSegment, type PersistenceRun } from './persistence-run'
import { getTranscriptionProfile } from './transcription-performance'
import { ASR_MODELS, assessModelMemory, browserDeviceMemoryGb } from './asr-models'
import { prepareDiarization, type DiarizationMode } from './diarization-mode'

const demoSegments: Segment[] = [
  { id: 'd1', start: 12.4, end: 17.9, text: 'Jadi, tujuan utama kita hari ini adalah menyelaraskan rencana kerja.', language: 'id', confidence: .94 },
  { id: 'd2', start: 17.9, end: 24.3, text: 'Betul, terutama untuk rilis kuartal kedua.', language: 'id', confidence: .91 },
  { id: 'd3', start: 24.3, end: 30.8, text: 'Can we also agree on the review milestones?', language: 'en', confidence: .96 },
  { id: 'd4', start: 30.8, end: 38.2, text: 'Bisa. Saya akan kirimkan jadwal revisinya setelah rapat ini.', language: 'id', confidence: .93 },
  { id: 'd5', start: 38.2, end: 44.7, text: 'Great, then the team can start on Monday.', language: 'en', confidence: .95 },
]

const MAX_BROWSER_MODEL_BYTES = 750 * 1024 * 1024

function friendlyModelError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  if (/abort|memory|allocate/i.test(detail)) return 'Model kehabisan memori WebAssembly. Muat ulang aplikasi, lalu gunakan versi Q5_0 atau model yang lebih kecil.'
  return detail
}

function App({ routeActive = true, diarizationMode: accountDiarizationMode = 'auto' }: { routeActive?: boolean; diarizationMode?: DiarizationMode }) {
  const [engine, setEngine] = useState<EngineState>('missing')
  const [modelName, setModelName] = useState('Belum dipilih')
  const [audioName, setAudioName] = useState('Tidak ada audio')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [pcm, setPcm] = useState<Float32Array | null>(null)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [language, setLanguage] = useState('auto')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('Pilih model multilingual whisper.cpp untuk memulai.')
  const [showSetup, setShowSetup] = useState(true)
  const [modelProgress, setModelProgress] = useState<number | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [runtimeProfile, setRuntimeProfile] = useState('Belum diukur')
  const [taskDiarizationOverride, setTaskDiarizationOverride] = useState<DiarizationMode | null>(null)
  const [checkingDiarization, setCheckingDiarization] = useState(false)
  const taskDiarizationMode = taskDiarizationOverride ?? accountDiarizationMode
  const audioRef = useRef<HTMLAudioElement>(null)
  const whisperRef = useRef<WhisperEngine | null>(null)
  const setupRef = useRef<HTMLDialogElement>(null)
  const taskIdRef = useRef<number | null>(null)
  const persistenceRunRef = useRef<PersistenceRun | null>(null)
  const chunkSecondsRef = useRef(30)

  useEffect(() => {
    const whisper = new WhisperEngine()
    whisper.onSegment = segment => {
      setSegments(value => [...value, segment]); setSelectedId(value => value || segment.id)
      const run = persistenceRunRef.current
      if (run) enqueueSegment(run, segment, appendTranscriptionSegment).catch(() => { run.failed = true; setMessage('Transkrip tetap tersedia, tetapi satu bagian gagal masuk arsip SQLite lokal.') })
    }
    whisper.onDone = () => {
      const run = persistenceRunRef.current
      if (!run) { setEngine('ready'); setMessage('Transkripsi selesai di sesi browser; arsip lokal tidak tersedia.'); return }
      setMessage('Transkripsi selesai; menyelesaikan arsip SQLite lokal…')
      run.segmentQueue = awaitPersistence(run).then(() => run.failed ? completeTranscription(run.taskId, 'error') : finalizeTranscription(run.taskId, run.segments)).then(record => {
        setMessage(run.failed ? 'Transkripsi selesai, tetapi arsip SQLite tidak lengkap dan ditandai gagal.' : record.diarization === 'local' ? `Transkripsi selesai dengan ${record.speakers.length} pembicara lokal.` : record.diarizationMode === 'off' ? 'Transkripsi selesai tanpa diarization sesuai pilihan tugas.' : 'Transkripsi selesai. Diarisasi lokal tidak tersedia; satu label pembicara digunakan.')
      }).catch(() => { run.failed = true; setMessage('Transkripsi selesai, tetapi status arsip lokal gagal diperbarui.') }).finally(() => {
        if (persistenceRunRef.current === run) { setEngine('ready'); setTaskDiarizationOverride(null) }
      })
    }
    whisper.onProgress = (completed, total) => setMessage(completed === total ? 'Menyelesaikan transkrip lokal…' : `Memproses bagian ${completed + 1} dari ${total} · batch ${chunkSecondsRef.current} detik…`)
    whisperRef.current = whisper
    return () => whisper.destroy()
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const update = () => setCurrent(audio.currentTime)
    const stop = () => setPlaying(false)
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('ended', stop)
    audio.addEventListener('pause', stop)
    return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('ended', stop); audio.removeEventListener('pause', stop) }
  }, [audioUrl])

  useEffect(() => {
    if (!routeActive) {
      audioRef.current?.pause()
    }
  }, [routeActive])

  useEffect(() => {
    if (!audioUrl) return
    return () => URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  useEffect(() => {
    const dialog = setupRef.current
    if (!dialog) return
    if (!routeActive) {
      if (dialog.open) dialog.close()
      return
    }
    if (!showSetup || dialog.open) return
    dialog.showModal()
  }, [routeActive, showSetup])

  const active = segments.find(segment => segment.id === selectedId) || null
  const filtered = useMemo(() => segments.filter(segment => segment.text.toLowerCase().includes(search.toLowerCase())), [segments, search])

  const loadModel = async (file: File) => {
    if (file.size > MAX_BROWSER_MODEL_BYTES) {
      setMessage('Model lebih besar dari batas aman browser (750 MB). Gunakan model Q5_0 atau jalankan model F16 melalui whisper.cpp native.')
      if (engine !== 'ready') setEngine('error')
      return
    }
    try {
      setEngine('loading'); setMessage(`Memuat ${file.name} ke memori lokal…`)
      await whisperRef.current?.loadModel(await file.arrayBuffer())
      setEngine('ready'); setModelName(file.name); setMessage('Model lokal siap. Audio tidak akan meninggalkan perangkat ini.'); setShowSetup(false)
    } catch (error) { setEngine('error'); setMessage(friendlyModelError(error)) }
  }

  const loadBundledModel = async (name: string) => {
    try {
      const memory = assessModelMemory(name, browserDeviceMemoryGb(navigator))
      if (memory.level === 'blocked') throw new Error(`${memory.model.label} memerlukan sedikitnya ${memory.model.minimumMemoryGb} GB RAM. Pilih model yang lebih kecil untuk perangkat ini.`)
      setEngine('loading'); setModelProgress(0); setMessage(`Membaca ${name} dari penyimpanan lokal…`)
      const response = await fetch(`/models/${name}`)
      if (!response.ok || !response.body) throw new Error(`Model lokal ${name} tidak ditemukan.`)
      const total = Number(response.headers.get('content-length')) || 0
      if (total > MAX_BROWSER_MODEL_BYTES) throw new Error('Model F16 ini melebihi batas aman browser. Gunakan versi Q5_0 yang tersedia.')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value); received += value.length
        if (received > MAX_BROWSER_MODEL_BYTES) {
          await reader.cancel()
          throw new Error('Model melebihi batas aman browser (750 MB).')
        }
        if (total) setModelProgress(Math.round((received / total) * 100))
      }
      const bytes = new Uint8Array(received)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      chunks.length = 0
      setMessage(`Mengaktifkan ${name} dengan whisper.cpp…`)
      await whisperRef.current?.loadModel(bytes.buffer)
      setEngine('ready'); setModelName(name); setMessage('Model lokal siap. Audio tidak akan meninggalkan perangkat ini.'); setShowSetup(false)
    } catch (error) {
      setEngine('error'); setMessage(friendlyModelError(error))
    } finally { setModelProgress(null) }
  }

  const loadAudio = async (file: File) => {
    if (engine === 'transcribing') {
      setMessage('Tunggu transkripsi dan penyimpanan SQLite selesai sebelum mengganti audio.')
      return
    }
    if (file.size > MAX_AUDIO_FILE_BYTES) {
      setMessage('Audio lebih besar dari batas aman 250 MB. Potong atau kompres rekaman sebelum memuatnya.')
      return
    }
    setMessage('Menyiapkan audio 16 kHz di perangkat…')
    try {
      taskIdRef.current = null
      persistenceRunRef.current = null
      const decoded = await decodeAudio(file)
      audioRef.current?.pause()
      setPlaying(false); setCurrent(0)
      setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name)
      setPcm(decoded.pcm); setDuration(decoded.duration); setSegments([]); setSelectedId(null)
      setMessage('Audio siap. Tekan Transkripsikan untuk menjalankan whisper.cpp secara lokal.')
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'audio-duration-out-of-range'
        ? 'Durasi audio harus lebih dari nol dan tidak boleh melebihi empat jam.'
        : 'Format audio tidak dapat dibaca oleh browser ini. Coba WAV, MP3, M4A, atau OGG.')
    }
  }

  const transcribe = async () => {
    if (!pcm || engine !== 'ready' || checkingDiarization) return
    setCheckingDiarization(true)
    setMessage(taskDiarizationMode === 'off' ? 'Diarization dimatikan untuk tugas ini…' : 'Memeriksa kesiapan pyannote lokal sebelum memproses audio…')
    const diarization = await prepareDiarization(taskDiarizationMode, async () => (await checkDiarizationReadiness()).status === 'ready' ? 'ready' : 'unavailable')
    setCheckingDiarization(false)
    if (!diarization.canStart) {
      setMessage('Mode Required memerlukan pyannote lokal yang siap. Jalankan sidecar atau pilih Auto/Off, lalu coba lagi.')
      return
    }
    const wav = diarization.shouldUpload ? encodePcm16Wav(pcm) : null
    if (taskDiarizationMode === 'required' && !wav) {
      setMessage('Audio ini melebihi batas WAV sementara untuk mode Required. Potong rekaman atau pilih Auto/Off.')
      return
    }
    setSegments([]); setSelectedId(null); setEngine('transcribing')
    setMessage(diarization.shouldUpload ? 'Pyannote lokal siap · menyiapkan worker transkripsi dan WAV sementara…' : taskDiarizationMode === 'off' ? 'Menyiapkan worker tanpa membuat WAV diarization…' : 'Pyannote belum tersedia · melanjutkan dengan satu label pembicara…')
    taskIdRef.current = null
    persistenceRunRef.current = null
    try {
      const task = await createTranscription(audioName, language, fetch, taskDiarizationMode)
      taskIdRef.current = task.id
      const upload = wav ? uploadDiarizationAudio(task.id, wav).catch(() => undefined) : Promise.resolve()
      persistenceRunRef.current = createPersistenceRun(task.id, upload)
    } catch {
      if (taskDiarizationMode === 'required') {
        setEngine('ready'); setMessage('Mode Required tidak dapat menyiapkan arsip dan WAV lokal. Transkripsi belum dimulai.'); return
      }
      setMessage('Arsip SQLite tidak tersedia; transkripsi tetap berjalan di memori browser…')
    }
    const profile = getTranscriptionProfile(modelName, navigator.hardwareConcurrency || 0, language, crossOriginIsolated)
    const startedAt = performance.now()
    chunkSecondsRef.current = profile.chunkSeconds
    setRuntimeProfile(`${profile.name} · ${profile.threads} thread · batch ${profile.chunkSeconds} dtk`)
    if (profile.language !== language) setMessage('Cahya Medium dikunci ke Bahasa Indonesia untuk mengurangi deteksi bahasa berulang…')
    try {
      await whisperRef.current?.transcribe(pcm, profile.language, profile.threads, profile.chunkSeconds)
      const elapsedSeconds = Math.max(1, (performance.now() - startedAt) / 1000)
      setRuntimeProfile(`${profile.name} · ${(duration / elapsedSeconds).toFixed(2)}× realtime · ${profile.threads} thread`)
    }
    catch (error) {
      const run = persistenceRunRef.current
      if (run) { run.failed = true; void run.segmentQueue.then(() => completeTranscription(run.taskId, 'error')).catch(() => undefined) }
      setEngine('error'); setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) { await audio.play(); setPlaying(true) } else { audio.pause(); setPlaying(false) }
  }

  const seek = (time: number) => {
    const next = Math.max(0, Math.min(Number.isFinite(time) ? time : 0, duration))
    if (audioRef.current) audioRef.current.currentTime = next
    setCurrent(next)
  }

  const exportTranscript = (format: 'txt' | 'srt') => {
    const content = format === 'srt'
      ? segments.map((segment, index) => `${index + 1}\n${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}\n${segment.text.trim()}`).join('\n\n')
      : formatCleanTxt(segments)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `transkrip.${format}`
    document.body.append(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const correctTranscript = async () => {
    if (!segments.length || correcting) return
    setCorrecting(true)
    setMessage('Model lokal sedang menyiapkan koreksi ejaan…')
    try {
      const result = await correctTranscriptLocally(segments.map(segment => segment.text), (done, total) => setMessage(`Model lokal mengoreksi paragraf ${done} dari ${total}…`))
      const correctedSegments = segments.map((segment, index) => ({ ...segment, text: result.corrected[index] ?? segment.text }))
      setSegments(correctedSegments)
      if (taskIdRef.current) await saveTranscription(taskIdRef.current, correctedSegments.map(segment => segment.text).join('\n\n'))
      const skipped = result.skipped ? ` ${result.skipped} paragraf dipertahankan karena struktur hasil berubah.` : ''
      setMessage(`${result.changed} paragraf dikoreksi dengan ${result.model}.${skipped}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setCorrecting(false) }
  }

  return <main className="app-shell">
    <header className="command-bar">
      <Brand href="#" label="Beranda Transkrip"/>
      <div className="privacy-state"><Icon name="shield"/><span><b>Audio tetap di perangkat</b><small>Tidak diunggah ke cloud</small></span></div>
      <label className="cell-select"><span>Bahasa</span><select value={language} onChange={e => setLanguage(e.target.value)}><option value="auto">Auto · ID + EN</option><option value="id">Bahasa Indonesia</option><option value="en">English</option></select></label>
      <button className="model-state" onClick={() => setShowSetup(true)}><Icon name="chip"/><span><b>{engine === 'ready' ? 'Model siap' : engine === 'transcribing' ? 'Memproses' : 'Siapkan model'}</b><small>{modelName}</small></span></button>
      <a className="secondary-nav settings-nav" href="#settings"><Icon name="settings"/><span><b>Settings</b><small>Model &amp; tampilan lokal</small></span></a>
      <a className="secondary-nav tasks-nav" href="#tasks"><Icon name="table"/><span><b>Tasks</b><small>Arsip SQLite</small></span></a>
      <a className="secondary-nav analysis-nav" href="#analysis"><Icon name="analysis"/><span><b>Analysis</b><small>Insight melalui DocETL</small></span></a>
      <a className="secondary-nav about-nav" href="#about"><Icon name="info"/><span><b>About</b><small>Sistem &amp; maintainer</small></span></a>
    </header>

    <section className="audio-deck" aria-label="Audio player">
      <div className="deck-heading"><span className="file-name"><Icon name="folder"/>{audioName}</span><span>{formatTime(current, true)} / {formatTime(duration, true)}</span></div>
      <Waveform pcm={pcm} duration={duration} current={current} onSeek={seek}/>
      <div className="transport">
        <button className="seek-step" aria-label="Mundur 5 detik" onClick={() => seek(current - 5)}><Icon name="rewind"/></button>
        <button className="primary-transport" aria-label={playing ? 'Jeda' : 'Putar'} onClick={togglePlay} disabled={!audioUrl}><Icon name={playing ? 'pause' : 'play'}/></button>
        <button className="seek-step" aria-label="Maju 5 detik" onClick={() => seek(current + 5)}><Icon name="forward"/></button>
        <span className="transport-time">{formatTime(current, true)}</span>
        <label className="file-action"><Icon name="upload"/><span>Pilih audio</span><input disabled={engine === 'transcribing'} type="file" accept="audio/*,video/mp4" onChange={e => e.target.files?.[0] && loadAudio(e.target.files[0])}/></label>
        <label className="diarization-task-mode"><span>Pembicara</span><select aria-label="Mode diarization untuk transkripsi ini" value={taskDiarizationMode} disabled={engine === 'transcribing' || checkingDiarization} onChange={event => setTaskDiarizationOverride(event.target.value as DiarizationMode)}><option value="auto">Auto</option><option value="required">Required</option><option value="off">Off</option></select></label>
        <button className="run-button" disabled={!pcm || engine !== 'ready' || checkingDiarization} onClick={transcribe}>{checkingDiarization ? 'Memeriksa…' : engine === 'transcribing' ? 'Sedang memproses…' : 'Transkripsikan'}</button>
      </div>
    </section>

    <section className="review-grid">
      <section className="transcript-panel" aria-labelledby="transcript-heading">
        <div className="panel-title"><h1 id="transcript-heading">Tinjau transkrip</h1><label className="search"><Icon name="search"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari di transkrip"/></label></div>
        <div className="transcript-body">
          {filtered.length ? filtered.map((segment) => <article key={segment.id} className={`segment ${selectedId === segment.id ? 'active' : ''}`}>
            <button className={`language-tag lang-${segment.language}`} aria-label="Pilih segmen dan buka bukti audio" onClick={() => { setSelectedId(segment.id); seek(segment.start) }}>{segment.language === 'id' ? 'ID' : segment.language === 'en' ? 'EN' : 'AU'}</button>
            <textarea aria-label="Paragraf transkrip" lang={segment.language === 'auto' ? undefined : segment.language} spellCheck value={segment.text} rows={Math.max(2, Math.ceil(segment.text.length / 76))} onFocus={() => setSelectedId(segment.id)} onChange={e => setSegments(values => values.map(value => value.id === segment.id ? { ...value, text: e.target.value } : value))}/>
          </article>) : segments.length ? <div className="empty-transcript" role="status"><h2>Tidak ada hasil</h2><p>Tidak ada paragraf yang cocok dengan “{search}”. Ubah atau hapus kata pencarian untuk melihat transkrip lagi.</p></div> : <div className="empty-transcript"><div className="empty-raster" aria-hidden="true"/><h2>Ruang tinjau siap</h2><p>Masukkan model multilingual dan audio untuk membuat transkrip Bahasa Indonesia atau English. Semua pemrosesan terjadi di perangkat ini.</p><div><label className="file-action prominent"><Icon name="upload"/>Pilih audio<input disabled={engine === 'transcribing'} type="file" accept="audio/*,video/mp4" onChange={e => e.target.files?.[0] && loadAudio(e.target.files[0])}/></label><button onClick={() => { setSegments(demoSegments); setSelectedId('d1'); setDuration(60); setMessage('Mode pratinjau — teks ini hanya data ilustratif.') }}>Pratinjau ruang kerja</button></div></div>}
        </div>
        <div className="edit-bar"><span>{segments.length} paragraf</span><span>{segments.reduce((count, segment) => count + (segment.text.match(/\S+/g)?.length ?? 0), 0)} kata</span><button disabled={!segments.length || correcting} onClick={correctTranscript}><Icon name="edit"/>{correcting ? 'Model bekerja…' : 'Koreksi ejaan lokal'}</button><button disabled={!segments.length} onClick={() => exportTranscript('txt')}><Icon name="download"/>TXT per kalimat</button><button disabled={!segments.length} onClick={() => exportTranscript('srt')}><Icon name="download"/>SRT + waktu</button></div>
      </section>

      <aside className="evidence-panel" aria-labelledby="evidence-heading">
        <div className="panel-title"><h2 id="evidence-heading">Bukti audio</h2><Icon name="edit"/></div>
        {active ? <div className="evidence-content">
          <div className="selection-readout"><span>Paragraf aktif</span><strong>{active.language === 'id' ? 'Bahasa Indonesia' : active.language === 'en' ? 'English' : 'Terdeteksi otomatis'}</strong></div>
          <dl><div><dt>Keyakinan</dt><dd>{active.confidence ? `${Math.round(active.confidence * 100)}%` : 'Dari whisper.cpp'}</dd></div><div><dt>Model lokal</dt><dd>{modelName}</dd></div></dl>
          <button className="jump-button" onClick={() => seek(active.start)}><Icon name="play"/>Putar dari segmen ini</button>
        </div> : <div className="inspector-empty"><div className="pixel-cursor"/><p>Pilih baris transkrip untuk memeriksa bukti audio, bahasa, dan waktunya.</p></div>}
        <div className="device-boundary"><Icon name="shield"/><div><b>Batas privasi</b><p>Whisper dan model audio tetap di browser. Diarization opsional mengirim WAV sementara hanya ke layanan loopback lokal lalu menghapusnya; koreksi teks memakai Ollama lokal.</p></div></div>
      </aside>
    </section>

    <footer className="status-strip" role="status"><span className={`status-dot state-${engine}`}/><span>{message}</span><span className="memory-note">{engine === 'transcribing' || runtimeProfile !== 'Belum diukur' ? runtimeProfile : crossOriginIsolated ? 'WASM threads aktif' : 'WASM threads perlu COOP/COEP'}</span></footer>
    {audioUrl && <audio ref={audioRef} src={audioUrl}/>} 

    {showSetup && <dialog ref={setupRef} className="setup-drawer" aria-labelledby="setup-title" onClose={() => setShowSetup(false)}>
      <button className="drawer-close" aria-label="Tutup" autoFocus onClick={() => setupRef.current?.close()}><Icon name="close"/></button>
      <h2 id="setup-title">Siapkan mesin transkripsi</h2>
      <p>Pilih model berdasarkan bahasa, akurasi, dan RAM perangkat. Aturan yang sama berlaku di macOS, Linux, dan Windows; model English-only tidak dapat mentranskripsikan Bahasa Indonesia.</p>
      <div className="bundled-models">
        {ASR_MODELS.map(model => {
          const memory = assessModelMemory(model.file, browserDeviceMemoryGb(navigator))
          const unavailable = memory.level === 'blocked'
          return <button key={model.file} disabled={engine === 'loading' || unavailable} onClick={() => loadBundledModel(model.file)}>
            <span><b>{model.label}</b><small>{model.sizeMb} MB · RAM min. {model.minimumMemoryGb} GB · disarankan {model.recommendedMemoryGb} GB · {model.description}</small></span><strong>{unavailable ? 'RAM tidak cukup' : 'Gunakan'}</strong>
          </button>
        })}
      </div>
      {modelProgress !== null && <progress className="model-progress" aria-label={`Memuat model ${modelProgress}%`} value={modelProgress} max="100"/>}
      <label className="model-drop"><Icon name="chip"/><span><b>Pilih model GGML dari perangkat</b><small>.bin · dibaca langsung ke memori browser</small></span><input disabled={engine === 'loading'} type="file" accept=".bin,application/octet-stream" onChange={e => e.target.files?.[0] && loadModel(e.target.files[0])}/></label>
      <div className="setup-facts"><span>Tidak ada cloud</span><span>WASM + loopback lokal</span><span>3 model lokal</span></div>
      {engine === 'error' && <div className="error-box">{message}</div>}
      <p className="setup-note">Model dan runtime whisper.cpp tersedia bersama aplikasi. Persyaratan mengikuti model, bukan sistem operasi. Jika browser tidak melaporkan RAM, aplikasi mengizinkan pemuatan dan tetap menangani kegagalan memori dengan aman.</p>
    </dialog>}
  </main>
}

export default App
