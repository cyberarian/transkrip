import { prepareLocalMedia } from './media-preparation'
import { audioReadyMessage } from './transcription-readiness'
import { isLoopbackHostname, MAX_LOCAL_MEDIA_BYTES } from './media-limits'
import { useWorkspaceCheckpoint } from './use-workspace-checkpoint'
import type { WorkspaceCheckpoint } from './workspace-checkpoint'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { decodeAudio, formatSrtTime, formatTime, LARGE_AUDIO_HINT_BYTES, MAX_AUDIO_FILE_BYTES, readAudioBytes } from './audio'
import { Icon } from './icons'
import { Brand } from './components/Brand'
import type { EngineState, Segment } from './types'
import { Waveform } from './components/Waveform'
import { WhisperEngine } from './whisper'
import { getCorrectionModel } from './correction-model'
import { correctTranscriptLocally } from './correction'
import { formatCleanTxt } from './export'
import { checkDiarizationReadiness, getTranscription, createTranscription, finalizeTranscription, saveTranscription, uploadDiarizationAudio } from './transcriptions-api'
import { encodePcm16Wav } from './wav'
import { awaitPersistence, createPersistenceRun, type PersistenceRun } from './persistence-run'
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
const pcmBuffers = new WeakMap<object, Float32Array>()

function friendlyModelError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  if (/abort|memory|allocate/i.test(detail)) return 'Model kehabisan memori WebAssembly. Muat ulang aplikasi, lalu gunakan versi Q5_0 atau model yang lebih kecil.'
  return detail
}

function App({ ownerId = 0, routeActive = true, diarizationMode: accountDiarizationMode = 'auto' }: { ownerId?: number; routeActive?: boolean; diarizationMode?: DiarizationMode }) {
  const [engine, setEngine] = useState<EngineState>('missing')
  const [modelName, setModelName] = useState('Belum dipilih')
  const [audioName, setAudioName] = useState('Tidak ada audio')
  const [audioHash, setAudioHash] = useState<string | null>(null)
  const [resumeState, setResumeState] = useState<WorkspaceCheckpoint['resume']>(null)
  const [restored, setRestored] = useState(false)
  const [localPreparation, setLocalPreparation] = useState(false)
  const audioLoadRef = useRef<AbortController | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioProgress, setAudioProgress] = useState<number | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const pcmKey = useRef<object>({})
  const [hasPcm, setHasPcm] = useState(false)
  const readPcm = useCallback(() => pcmBuffers.get(pcmKey.current) ?? null, [])
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
  const [taskId, setTaskId] = useState<number | null>(null)
  const taskIdRef = useRef<number | null>(null)
  const persistenceRunRef = useRef<PersistenceRun | null>(null)
  const chunkSecondsRef = useRef(30)

  const restore = useCallback((value: WorkspaceCheckpoint) => {
    taskIdRef.current = value.taskId; setTaskId(value.taskId)
    setAudioName(value.audioFile); setAudioHash(value.audioHash); setDuration(value.duration)
    setCurrent(value.position); setLanguage(value.language); setModelName(value.modelName)
    setSegments(value.segments); setSelectedId(value.selectedId); setResumeState(value.resume); setTaskDiarizationOverride(value.diarizationMode ?? null)
    setRestored(true); setShowSetup(false)
    setMessage('Ruang kerja dipulihkan. Pilih kembali rekaman yang sama untuk memutar atau melanjutkan; teks dan waktu sudah tersedia.')
  }, [])
  const checkpoint = useMemo<WorkspaceCheckpoint>(() => ({
    version: 1, audioFile: audioName, audioHash, duration, position: Math.min(current, duration),
    language, modelName, selectedId, taskId, segments, resume: resumeState, diarizationMode: taskDiarizationMode,
  }), [audioName, audioHash, duration, current, language, modelName, selectedId, taskId, segments, resumeState, taskDiarizationMode])
  const checkpointRef = useRef(checkpoint)
  useEffect(() => { checkpointRef.current = checkpoint }, [checkpoint])
  const { ready: checkpointReady, status: checkpointStatus, saveNow, planManualSave } = useWorkspaceCheckpoint(ownerId, checkpoint, restore)
  const saveNowRef = useRef(saveNow)
  useEffect(() => { saveNowRef.current = saveNow }, [saveNow])

  useEffect(() => {
    const whisper = new WhisperEngine()
    whisper.onSegment = segment => {
      setSegments(value => [...value, segment]); setSelectedId(value => value || segment.id)
      const run = persistenceRunRef.current
      if (run) run.segments.push(segment)
    }
    whisper.onDone = () => {
      const run = persistenceRunRef.current
      if (!run) { setEngine('ready'); setMessage('Transkripsi selesai di sesi browser; arsip lokal tidak tersedia.'); return }
      setMessage('Transkripsi selesai; menyelesaikan arsip SQLite lokal…')
      run.segmentQueue = awaitPersistence(run).then(async () => {
        await saveNowRef.current({ ...checkpointRef.current, taskId: run.taskId, segments: run.segments.slice(), selectedId: run.segments[0]?.id ?? null })
        return finalizeTranscription(run.taskId, run.segments)
      }).then(async record => {
        setResumeState(null)
        await saveNowRef.current({ ...checkpointRef.current, taskId: run.taskId, segments: run.segments.slice(), selectedId: run.segments[0]?.id ?? null, resume: null })
        setMessage(run.failed ? 'Transkripsi selesai, tetapi arsip SQLite tidak lengkap dan ditandai gagal.' : record.diarization === 'local' ? `Transkripsi selesai dengan ${record.speakers.length} pembicara lokal.` : record.diarizationMode === 'off' ? 'Transkripsi selesai tanpa diarization sesuai pilihan tugas.' : 'Transkripsi selesai. Diarisasi lokal tidak tersedia; satu label pembicara digunakan.')
      }).catch(() => { run.failed = true; setMessage('Transkripsi selesai, tetapi status arsip lokal gagal diperbarui.') }).finally(() => {
        if (persistenceRunRef.current === run) { setEngine('ready'); setTaskDiarizationOverride(null) }
      })
    }
    whisper.onProgress = (completed, total) => setMessage(completed === total ? 'Menyelesaikan transkrip lokal…' : `Memproses bagian ${completed + 1} dari ${total} · batch ${chunkSecondsRef.current} detik…`)
    whisper.onCheckpoint = async nextSample => {
      const run = persistenceRunRef.current
      if (!run) throw new Error('Arsip belum tersedia.')
      const resume = { nextSample, segmentCount: run.segments.length, chunkSeconds: chunkSecondsRef.current }
      const value = { ...checkpointRef.current, taskId: run.taskId, segments: run.segments.slice(), selectedId: run.segments[0]?.id ?? null, resume }
      checkpointRef.current = value
      setResumeState(resume)
      await saveNowRef.current(value)
    }
    whisperRef.current = whisper
    return () => { audioLoadRef.current?.abort(); whisper.destroy() }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const restorePosition = () => { audio.currentTime = checkpointRef.current.position }
    audio.addEventListener('loadedmetadata', restorePosition, { once: true })
    const update = () => setCurrent(audio.currentTime)
    const stop = () => setPlaying(false)
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('ended', stop)
    audio.addEventListener('pause', stop)
    return () => { audio.removeEventListener('loadedmetadata', restorePosition); audio.removeEventListener('timeupdate', update); audio.removeEventListener('ended', stop); audio.removeEventListener('pause', stop) }
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

  useEffect(() => {
    if (engine !== 'transcribing' || !('wakeLock' in navigator)) return
    let active = true
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      if (!active || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const granted = await navigator.wakeLock.request('screen')
        if (!active) { await granted.release(); return }
        lock = granted
      } catch { /* Durable checkpoints work even when the OS refuses a wake lock. */ }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => { active = false; document.removeEventListener('visibilitychange', acquire); void lock?.release().catch(() => undefined) }
  }, [engine])

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
    if (!checkpointReady || audioLoadRef.current || audioLoading || checkingDiarization || correcting || engine === 'transcribing') {
      setMessage('Tunggu transkripsi dan penyimpanan SQLite selesai sebelum mengganti audio.')
      return
    }
    if (file.size > (localPreparation ? MAX_LOCAL_MEDIA_BYTES : MAX_AUDIO_FILE_BYTES)) {
      setMessage(localPreparation ? 'Berkas melebihi batas persiapan lokal 2 GB.' : 'Berkas melebihi batas browser 250 MB. Gunakan persiapan FFmpeg lokal untuk berkas hingga 2 GB, atau potong rekaman.')
      return
    }
    setAudioLoading(true)
    setAudioProgress(0)
    if (file.size > LARGE_AUDIO_HINT_BYTES) {
      const proceed = window.confirm(`Rekaman ini ${Math.round(file.size / (1024 * 1024))} MB. Menyiapkannya membutuhkan memori dan waktu di perangkat ini, dan dapat gagal bila RAM terbatas. Lanjutkan?`)
      if (!proceed) { setAudioProgress(null); setAudioLoading(false); return }
      setMessage('Membaca rekaman besar…')
    } else {
      setMessage('Menyiapkan audio 16 kHz di perangkat…')
    }
    const controller = new AbortController()
    audioLoadRef.current = controller
    try {
      let bytes: ArrayBuffer | undefined
      let decoded: { pcm: Float32Array; duration: number } | undefined
      let hash: string
      if (localPreparation) {
        setMessage('Mengirim berkas ke layanan pada perangkat ini…')
        const prepared = await prepareLocalMedia(file, ownerId, controller.signal, progress => {
          setAudioProgress(progress.percent)
          setMessage(progress.phase === 'uploading' ? 'Membaca berkas ke penyimpanan sementara lokal…' : progress.phase === 'converting' ? 'FFmpeg sedang mengekstrak audio di perangkat ini…' : 'Menyiapkan audio hasil konversi…')
        })
        decoded = prepared; hash = prepared.hash
      } else {
        // Read once with progress; finish hashing before the decoder consumes bytes.
        bytes = await readAudioBytes(file, percent => setAudioProgress(percent), controller.signal)
        setAudioProgress(null); setMessage('Memeriksa identitas rekaman…')
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      }
      controller.signal.throwIfAborted()
      let keepRestored = restored
      if (restored && audioHash && hash !== audioHash) {
        setAudioProgress(null)
        const proceed = window.confirm('Audio ini berbeda dari rekaman pada ruang kerja yang dipulihkan. Buang teks yang dipulihkan dan mulai transkripsi baru untuk rekaman ini? Teks lama tetap tersedia di halaman Tasks.')
        if (!proceed) {
          setMessage('Ruang kerja yang dipulihkan tetap dipakai. Pilih rekaman asli untuk melanjutkan, atau gunakan Ruang kerja baru untuk memulai ulang.')
          return
        }
        keepRestored = false
      }
      setMessage('Menyiapkan audio 16 kHz di perangkat…')
      decoded ??= await decodeAudio(bytes!, controller.signal)
      controller.signal.throwIfAborted()
      setAudioProgress(null)
      if (!keepRestored) { taskIdRef.current = null; setTaskId(null); persistenceRunRef.current = null }
      if (!keepRestored) setTaskDiarizationOverride(null)
      setAudioHash(hash)
      audioRef.current?.pause()
      setPlaying(false); if (!keepRestored) setCurrent(0)
      setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name)
      pcmBuffers.set(pcmKey.current, decoded.pcm); setHasPcm(true); setDuration(decoded.duration)
      if (!keepRestored) { setSegments([]); setSelectedId(null); setResumeState(null) }
      setRestored(false)
      setMessage('Audio siap.')
    } catch (error) {
      setAudioProgress(null)
      const detail = error instanceof Error ? error.message : String(error)
      if (controller.signal.aborted) { setMessage('Persiapan dibatalkan. Rekaman sebelumnya tetap tersedia.'); return }
      if (localPreparation) { setMessage(detail); return }
      console.error('Audio load failed:', error)
      if (error instanceof Error && error.message === 'audio-file-too-large') {
        setMessage('Rekaman terlalu besar untuk disiapkan di perangkat ini (maksimal 250 MB). Potong atau kompres rekaman, lalu coba lagi.')
      } else if (error instanceof Error && error.message.startsWith('decode-audio-failed:')) {
        setMessage('Format audio tidak dapat dibaca oleh browser ini. Coba WAV, MP3, M4A, atau OGG.')
      } else if (error instanceof Error && error.message === 'audio-duration-out-of-range') {
        setMessage('Durasi audio harus lebih dari nol dan tidak boleh melebihi empat jam.')
      } else if (error instanceof Error && (detail.includes('Gagal memutar') || detail.includes('Render gagal') || detail.includes('play') || detail.includes('media'))) {
        setMessage('File tidak dapat diputar di browser ini. Coba konversi ke WAV, MP3, atau M4A, lalu coba lagi.')
      } else if (error instanceof Error && (detail.includes('terlalu lambat') || detail.includes('Gagal memuat'))) {
        setMessage('File terlalu lambat dimuat atau browser tidak mendukung codec. Coba file yang lebih kecil atau konversi ke WAV/MP3.')
      } else if (error instanceof Error && detail.includes('korrup') || detail.includes('korup')) {
        setMessage('File audio mungkin korup. Coba file lain atau konversi ke format yang lebih sederhana.')
      } else {
        setMessage(file.size > LARGE_AUDIO_HINT_BYTES
          ? 'Rekaman besar gagal disiapkan. Memori lokal tidak cukup. Potong atau kompres rekaman, lalu coba lagi.'
          : 'Audio tidak dapat disiapkan. Coba lagi, atau gunakan rekaman yang lebih kecil.')
      }
    } finally { audioLoadRef.current = null; setAudioLoading(false) }
  }

  const discardRestoredWorkspace = () => {
    if (engine === 'transcribing' || audioLoading || checkingDiarization || correcting) {
      setMessage('Tunggu proses yang sedang berjalan selesai sebelum memulai ruang kerja baru.')
      return
    }
    audioRef.current?.pause()
    setRestored(false)
    setPlaying(false); setTaskId(null); taskIdRef.current = null; persistenceRunRef.current = null
    setSegments([]); setSelectedId(null); setResumeState(null); setTaskDiarizationOverride(null)
    setAudioHash(null); setAudioUrl(null); pcmBuffers.delete(pcmKey.current); setHasPcm(false); setDuration(0); setCurrent(0)
    setAudioName('Tidak ada audio'); setLanguage('auto')
    setMessage('Ruang kerja baru siap. Pilih audio untuk memulai transkripsi baru; teks sebelumnya tetap ada di halaman Tasks.')
  }

  const transcribe = async () => {
    const pcm = readPcm()
    if (!pcm || engine !== 'ready' || checkingDiarization || audioLoading || !checkpointReady) return
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
    const previous = resumeState ? segments.slice(0, resumeState.segmentCount) : []
    setSegments(previous); setSelectedId(previous[0]?.id ?? null); setEngine('transcribing')
    setMessage(diarization.shouldUpload ? 'Pyannote lokal siap · menyiapkan worker transkripsi dan WAV sementara…' : taskDiarizationMode === 'off' ? 'Menyiapkan worker tanpa membuat WAV diarization…' : 'Pyannote belum tersedia · melanjutkan dengan satu label pembicara…')
    const recoveringTaskId = resumeState ? taskIdRef.current : null
    taskIdRef.current = null; setTaskId(null)
    persistenceRunRef.current = null
    try {
      const existing = recoveringTaskId ? await getTranscription(recoveringTaskId) : null
      if (existing && existing.status !== 'processing' && existing.status !== 'error') {
        taskIdRef.current = existing.id; setTaskId(existing.id); setResumeState(null); setEngine('ready')
        await saveNow({ ...checkpointRef.current, taskId: existing.id, resume: null })
        setMessage('Tugas ini sudah selesai. Checkpoint dipulihkan tanpa memproses ulang audio.')
        return
      }
      const task = existing?.status === 'processing' ? existing : await createTranscription(audioName, language, fetch, taskDiarizationMode)
      taskIdRef.current = task.id; setTaskId(task.id)
      const upload = wav ? uploadDiarizationAudio(task.id, wav).catch(() => undefined) : Promise.resolve()
      persistenceRunRef.current = createPersistenceRun(task.id, upload)
      persistenceRunRef.current.segments = previous.slice()
    } catch {
      setEngine('ready'); setMessage('Penyimpanan lokal belum tersedia. Transkripsi belum dimulai agar progres tidak hilang.'); return
    }
    const profile = getTranscriptionProfile(modelName, navigator.hardwareConcurrency || 0, language, crossOriginIsolated)
    const startedAt = performance.now()
    chunkSecondsRef.current = resumeState?.chunkSeconds ?? profile.chunkSeconds
    setRuntimeProfile(`${profile.name} · ${profile.threads} thread · batch ${profile.chunkSeconds} dtk`)
    if (profile.language !== language) setMessage('Cahya Medium dikunci ke Bahasa Indonesia untuk mengurangi deteksi bahasa berulang…')
    try {
      const resume = resumeState ?? { nextSample: 0, segmentCount: 0, chunkSeconds: profile.chunkSeconds }
      const initial = { ...checkpointRef.current, taskId: taskIdRef.current, segments: previous, selectedId: previous[0]?.id ?? null, resume, language: profile.language }
      checkpointRef.current = initial
      setResumeState(resume); setLanguage(profile.language)
      await saveNow(initial)
      await whisperRef.current?.transcribe(pcm, profile.language, profile.threads, resume.chunkSeconds, resume.nextSample)
      const elapsedSeconds = Math.max(1, (performance.now() - startedAt) / 1000)
      setRuntimeProfile(`${profile.name} · ${(Math.max(0, duration - (resumeState?.nextSample ?? 0) / 16000) / elapsedSeconds).toFixed(2)}× realtime · ${profile.threads} thread`)
    }
    catch (error) {
      const run = persistenceRunRef.current
      if (run) { run.failed = true; void saveNow({ ...checkpointRef.current, taskId: run.taskId, segments: run.segments.slice(), selectedId: run.segments[0]?.id ?? null }).catch(() => undefined) }
      setEngine('error'); setMessage(`${error instanceof Error ? error.message : String(error)} Progres tersimpan tetap tersedia. Muat kembali model, lalu lanjutkan.`)
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

  const exportWord = async () => {
    try {
      const { transcriptDocx, saveDocx } = await import('./docx-export')
      saveDocx(await transcriptDocx({ title: 'Transkrip', source: audioName, language, segments: segments.slice() }), 'transkrip.docx')
    } catch { setMessage('Dokumen Word gagal dibuat. Coba lagi atau gunakan ekspor TXT.') }
  }

  const correctTranscript = async () => {
    if (!segments.length || correcting || engine === 'transcribing' || !checkpointReady) return
    setCorrecting(true)
    setMessage('Model lokal sedang menyiapkan koreksi ejaan…')
    try {
      const result = await correctTranscriptLocally(segments.map(segment => segment.text), (done, total) => setMessage(`Model lokal mengoreksi paragraf ${done} dari ${total}…`), getCorrectionModel(), async partial => {
        const updated = segments.map((segment, index) => ({ ...segment, text: partial[index] ?? segment.text }))
        setSegments(updated)
        await saveNow({ ...checkpointRef.current, segments: updated })
      })
      const correctedSegments = segments.map((segment, index) => ({ ...segment, text: result.corrected[index] ?? segment.text }))
      setSegments(correctedSegments)
      if (taskIdRef.current) await saveTranscription(taskIdRef.current, correctedSegments.map(segment => segment.text).join('\n\n'))
      const skipped = result.skipped ? ` ${result.skipped} paragraf dipertahankan karena struktur hasil berubah.` : ''
      setMessage(`${result.changed} paragraf dikoreksi dengan ${result.model}.${skipped}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally { setCorrecting(false) }
  }

  return <main className="app-shell" data-recoverable="true">
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

    <section className="checkpoint-bar" aria-label="Penyimpanan ruang kerja">
      <div><Icon name="shield"/><span role="status">{checkpointStatus}</span></div>
      {(restored || resumeState) && <p>{resumeState ? `Progres tersimpan sampai ${formatTime(resumeState.nextSample / 16000)}. ` : ''}{!hasPcm ? 'Pilih rekaman asli untuk melanjutkan audio, atau buang ruang kerja ini untuk memakai rekaman lain. ' : ''}{engine !== 'ready' && engine !== 'transcribing' ? 'Muat model untuk melanjutkan transkripsi.' : ''}</p>}
      {(restored || resumeState) && <button className="checkpoint-discard" onClick={discardRestoredWorkspace}>Ruang kerja baru</button>}
      <button className="checkpoint-save" onClick={planManualSave}>Simpan sekarang</button>
    </section>

    <section className="audio-deck" aria-label="Audio player">
      <div className="deck-heading"><span className="file-name"><Icon name="folder"/>{audioName}</span><span>{formatTime(current, true)} / {formatTime(duration, true)}</span></div>
      <Waveform hasPcm={hasPcm} readPcm={readPcm} duration={duration} current={current} onSeek={seek}/>
        <label className="media-preparation-mode"><input type="checkbox" checked={localPreparation} disabled={audioLoading || engine === 'transcribing' || !isLoopbackHostname(location.hostname)} onChange={event => setLocalPreparation(event.target.checked)}/><span>Siapkan dengan FFmpeg lokal<small>Berkas hingga 2 GB · salinan sementara di perangkat dihapus setelah persiapan. Memerlukan FFmpeg.</small></span></label>
      <div className="transport">
        <button className="seek-step" aria-label="Mundur 5 detik" onClick={() => seek(current - 5)}><Icon name="rewind"/></button>
        <button className="primary-transport" aria-label={playing ? 'Jeda' : 'Putar'} onClick={togglePlay} disabled={!audioUrl}><Icon name={playing ? 'pause' : 'play'}/></button>
        <button className="seek-step" aria-label="Maju 5 detik" onClick={() => seek(current + 5)}><Icon name="forward"/></button>
        <span className="transport-time">{formatTime(current, true)}</span>
        {audioLoading && <button type="button" onClick={() => { audioLoadRef.current?.abort(); setMessage('Menghentikan persiapan…'); }}><Icon name="close"/>Batalkan persiapan</button>}
        <label className="file-action"><Icon name="upload"/><span>Pilih audio</span><input disabled={!checkpointReady || audioLoading || checkingDiarization || correcting || engine === 'transcribing'} aria-label="Pilih rekaman audio atau video" type="file" accept={localPreparation ? "audio/*,video/*,.mkv,.avi,.mov,.webm" : "audio/*,video/mp4"} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void loadAudio(file) }}/></label>
        {audioLoading && audioProgress !== null && <progress className="audio-progress" aria-label={`Membaca audio ${audioProgress}%`} value={audioProgress} max="100"/>}
        <label className="diarization-task-mode"><span>Pembicara</span><select aria-label="Mode diarization untuk transkripsi ini" value={taskDiarizationMode} disabled={engine === 'transcribing' || checkingDiarization} onChange={event => setTaskDiarizationOverride(event.target.value as DiarizationMode)}><option value="auto">Auto</option><option value="required">Required</option><option value="off">Off</option></select></label>
        {hasPcm && !audioLoading && (engine === 'missing' || engine === 'error') && <button type="button" onClick={() => setShowSetup(true)}>Siapkan model untuk transkripsi</button>}
        <button className="run-button" disabled={!checkpointReady || audioLoading || !hasPcm || engine !== 'ready' || checkingDiarization} onClick={transcribe}>{checkingDiarization ? 'Memeriksa…' : engine === 'transcribing' ? 'Sedang memproses…' : resumeState ? 'Lanjutkan transkripsi' : 'Transkripsikan'}</button>
      </div>
    </section>

    <section className="review-grid">
      <section className="transcript-panel" aria-labelledby="transcript-heading">
        <div className="panel-title"><h1 id="transcript-heading">Tinjau transkrip</h1><label className="search"><Icon name="search"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari di transkrip"/></label></div>
        <div className="transcript-body">
          {filtered.length ? filtered.map((segment) => <article key={segment.id} className={`segment ${selectedId === segment.id ? 'active' : ''}`}>
            <button className={`language-tag lang-${segment.language}`} aria-label="Pilih segmen dan buka bukti audio" onClick={() => { setSelectedId(segment.id); seek(segment.start) }}>{segment.language === 'id' ? 'ID' : segment.language === 'en' ? 'EN' : 'AU'}</button>
            <textarea readOnly={!checkpointReady || correcting || engine === 'transcribing'} aria-label="Paragraf transkrip" lang={segment.language === 'auto' ? undefined : segment.language} spellCheck value={segment.text} rows={Math.max(2, Math.ceil(segment.text.length / 76))} onFocus={() => setSelectedId(segment.id)} onChange={e => setSegments(values => values.map(value => value.id === segment.id ? { ...value, text: e.target.value } : value))}/>
          </article>) : segments.length ? <div className="empty-transcript" role="status"><h2>Tidak ada hasil</h2><p>Tidak ada paragraf yang cocok dengan “{search}”. Ubah atau hapus kata pencarian untuk melihat transkrip lagi.</p></div> : <div className="empty-transcript"><div className="empty-raster" aria-hidden="true"/><h2>Dari percakapan,<br/>menjadi pemahaman.</h2><p>Masukkan model multilingual dan audio untuk membuat transkrip Bahasa Indonesia atau English. Semua pemrosesan terjadi di perangkat ini.</p><div><label className="file-action prominent"><Icon name="upload"/>Pilih audio<input disabled={!checkpointReady || audioLoading || checkingDiarization || correcting || engine === 'transcribing'} aria-label="Pilih rekaman audio atau video" type="file" accept={localPreparation ? "audio/*,video/*,.mkv,.avi,.mov,.webm" : "audio/*,video/mp4"} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void loadAudio(file) }}/></label><button onClick={() => { setSegments(demoSegments); setSelectedId('d1'); setDuration(60); setMessage('Mode pratinjau — teks ini hanya data ilustratif.') }}>Pratinjau ruang kerja</button></div></div>}
        </div>
        <div className="edit-bar"><span>{segments.length} paragraf</span><span>{segments.reduce((count, segment) => count + (segment.text.match(/\S+/g)?.length ?? 0), 0)} kata</span><button disabled={!segments.length || correcting || engine === 'transcribing' || !checkpointReady} onClick={correctTranscript}><Icon name="edit"/>{correcting ? 'Model bekerja…' : 'Koreksi ejaan lokal'}</button><button disabled={!segments.length} onClick={() => exportTranscript('txt')}><Icon name="download"/>TXT per kalimat</button><button disabled={!segments.length} onClick={() => exportTranscript('srt')}><Icon name="download"/>SRT + waktu</button><button disabled={!segments.length} onClick={() => void exportWord()}><Icon name="download"/>DOCX</button></div>
      </section>

      <aside className="evidence-panel" aria-labelledby="evidence-heading">
        <div className="panel-title"><h2 id="evidence-heading">Bukti audio</h2><Icon name="edit"/></div>
        {active ? <div className="evidence-content">
          <div className="selection-readout"><span>Paragraf aktif</span><strong>{active.language === 'id' ? 'Bahasa Indonesia' : active.language === 'en' ? 'English' : 'Terdeteksi otomatis'}</strong></div>
          <dl><div><dt>Keyakinan</dt><dd>{active.confidence ? `${Math.round(active.confidence * 100)}%` : 'Dari whisper.cpp'}</dd></div><div><dt>Model lokal</dt><dd>{modelName}</dd></div></dl>
          <button className="jump-button" onClick={() => seek(active.start)}><Icon name="play"/>Putar dari segmen ini</button>
        </div> : <div className="inspector-empty"><div className="pixel-cursor"/><p>Pilih baris transkrip untuk memeriksa bukti audio, bahasa, dan waktunya.</p></div>}
        <div className="device-boundary"><Icon name="shield"/><div><b>Batas privasi</b><p>Whisper dan model audio tetap di browser. Persiapan FFmpeg dan diarization opsional memakai salinan media sementara pada layanan lokal lalu menghapusnya; koreksi teks memakai Ollama lokal.</p></div></div>
      </aside>
    </section>

    <footer className="status-strip" role="status"><span className={`status-dot state-${engine}`}/><span>{message === 'Audio siap.' ? audioReadyMessage(engine, Boolean(resumeState)) : message}</span><span className="memory-note">{engine === 'transcribing' || runtimeProfile !== 'Belum diukur' ? runtimeProfile : crossOriginIsolated ? 'WASM threads aktif' : 'WASM threads perlu COOP/COEP'}</span></footer>
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
