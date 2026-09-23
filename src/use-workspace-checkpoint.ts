import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CheckpointWriter, parseWorkspaceCheckpoint, type CheckpointOperation, type WorkspaceCheckpoint } from './workspace-checkpoint'

export function useWorkspaceCheckpoint(ownerId: number, checkpoint: WorkspaceCheckpoint, restore: (value: WorkspaceCheckpoint) => void) {
  const writer = useRef<CheckpointWriter | null>(null)
  const everReady = useRef(false)
  const latestCheckpoint = useRef(checkpoint)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Membaca checkpoint lokal…')
  const [retry, setRetry] = useState(0)
  const mounted = useRef(false)
  const blocked = useRef(false)
  const flush = useCallback(async () => {
    if (!writer.current) return
    if (blocked.current) throw new Error('Konflik checkpoint. Unduh teks sebelum memuat ulang.')
    try {
      if (writer.current.dirty && mounted.current) setStatus('Menyimpan perubahan…')
      await writer.current.flush()
      if (mounted.current) setStatus('Tersimpan di perangkat')
    } catch (error) {
      if (mounted.current) setStatus(error instanceof TypeError || (error instanceof Error && error.name === 'TimeoutError') ? 'Belum tersimpan. Layanan lokal terputus; perubahan tetap di tab ini. Sambungkan kembali lalu simpan.' : error instanceof Error ? error.message : 'Belum tersimpan. Coba simpan lagi sebelum menutup tab.')
      throw error
    }
  }, [])

  useLayoutEffect(() => { latestCheckpoint.current = checkpoint }, [checkpoint])

  useEffect(() => {
    let active = true
    mounted.current = true
    const rearm = everReady.current
    const controller = new AbortController()
    const headers = { 'Content-Type': 'application/json', 'X-Workspace-Owner': String(ownerId) }
    const read = async (response: Response) => {
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('transkrip:unauthenticated'))
        if (response.status === 409) blocked.current = true
        throw new Error(body.error?.message || 'Checkpoint belum tersimpan. Periksa layanan lokal dan coba lagi.')
      }
      return body.data
    }
    const save = async (operation: CheckpointOperation) => {
      const body = JSON.stringify(operation)
      // Fetch keepalive is limited to 64 KiB in browsers. Larger checkpoints save normally.
      return read(await fetch('/api/workspace', { method: 'PUT', headers, body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), keepalive: new TextEncoder().encode(body).length < 60000 })) as Promise<{ revision: number }>
    }
    fetch('/api/workspace', { headers, signal: controller.signal }).then(read).then(data => {
      if (!active) return
      // A manual re-arm after a conflict must not clobber unsaved local state with the server copy.
      if (!rearm && data.checkpoint) restore(parseWorkspaceCheckpoint(data.checkpoint))
      writer.current = new CheckpointWriter(data.revision, save)
      everReady.current = true
      blocked.current = false
      if (rearm) {
        writer.current.stage(latestCheckpoint.current)
        setStatus('Penyimpanan lokal tersambung kembali')
        void flush().catch(() => undefined)
      } else {
        setStatus(data.checkpoint ? 'Ruang kerja dipulihkan dari perangkat' : 'Penyimpanan lokal siap')
      }
      setReady(true)
    }).catch(error => {
      if (!active) return
      setReady(false)
      setStatus(error instanceof Error ? error.message : 'Checkpoint tidak dapat dibaca.')
    })
    return () => { active = false; mounted.current = false; writer.current?.dispose(); writer.current = null; controller.abort() }
  }, [ownerId, restore, retry, flush])

  useLayoutEffect(() => {
    if (!ready || !writer.current) return
    writer.current.stage(checkpoint)
    const timer = window.setTimeout(() => { void flush().catch(() => undefined) }, 500)
    return () => window.clearTimeout(timer)
  }, [checkpoint, ready, flush])

  useEffect(() => {
    const save = () => { void flush().catch(() => undefined) }
    const warn = (event: BeforeUnloadEvent) => {
      if (writer.current?.dirty) { save(); event.preventDefault(); event.returnValue = '' }
    }
    const authenticated = (event: Event) => { if ((event as CustomEvent<number>).detail === ownerId) save() }
    document.addEventListener('visibilitychange', save)
    document.addEventListener('freeze', save)
    document.addEventListener('resume', save)
    const commit = (event: Event) => { (event as CustomEvent<Promise<void>[]>).detail.push(flush()) }
    window.addEventListener('transkrip:flush', commit)
    window.addEventListener('pagehide', save)
    window.addEventListener('pageshow', save)
    window.addEventListener('online', save)
    window.addEventListener('transkrip:authenticated', authenticated)
    window.addEventListener('beforeunload', warn)
    const retryTimer = window.setInterval(() => { if (writer.current?.dirty && document.visibilityState === 'visible') save() }, 15000)
    return () => {
      document.removeEventListener('visibilitychange', save); document.removeEventListener('freeze', save); document.removeEventListener('resume', save)
      window.removeEventListener('transkrip:flush', commit)
      window.removeEventListener('pagehide', save); window.removeEventListener('pageshow', save); window.removeEventListener('online', save)
      window.removeEventListener('transkrip:authenticated', authenticated); window.removeEventListener('beforeunload', warn); window.clearInterval(retryTimer)
    }
  }, [flush, ownerId])

  const saveNow = useCallback(async (value: WorkspaceCheckpoint) => {
    if (!writer.current || blocked.current) throw new Error('Checkpoint tidak tersedia. Pulihkan koneksi atau muat ulang sebelum memulai.')
    writer.current.stage(value)
    await flush()
  }, [flush])
  // Manual save: retry the pending operation, or re-read the revision after a conflict, instead of dead-ending.
  const planManualSave = useCallback(() => {
    if (!ready || blocked.current) { setRetry(value => value + 1); return }
    void flush().catch(() => undefined)
  }, [ready, flush])
  return { ready, status, saveNow, planManualSave }
}
