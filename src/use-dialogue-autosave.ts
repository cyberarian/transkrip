import { useCallback, useEffect, useRef } from 'react'
import type { SpeakerDocument } from './speaker-document'
import { saveSpeakerDocument } from './transcriptions-api'

// Pending documents remain in memory across route changes and a locked session.
export function useDialogueAutosave(ownerId: number, report: (message: string) => void) {
  const pending = useRef(new Map<number, SpeakerDocument>())
  const saving = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)
  const flush = useCallback((): Promise<void> => {
    if (saving.current) return saving.current
    const drain = async () => {
      while (pending.current.size) {
        const [id, document] = pending.current.entries().next().value!
        if (document.speakers.some(speaker => !speaker.label.trim())) throw new Error('Isi nama pembicara agar dialog dapat disimpan otomatis.')
        await saveSpeakerDocument(id, document, fetch, ownerId)
        if (pending.current.get(id) === document) pending.current.delete(id)
        if (active.current) report(`Dialog #${id} tersimpan otomatis di perangkat.`)
      }
    }
    saving.current = drain().catch(error => {
      if (active.current) report(error instanceof Error ? error.message : 'Perubahan dialog belum tersimpan. Jangan tutup tab; periksa layanan lokal.')
      throw error
    }).finally(() => { saving.current = null })
    return saving.current
  }, [ownerId, report])
  const stage = useCallback((id: number, document: SpeakerDocument) => {
    pending.current.set(id, document)
    report('Perubahan dialog belum tersimpan…')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void flush().catch(() => undefined) }, 600)
  }, [flush, report])
  useEffect(() => {
    active.current = true
    const save = () => { void flush().catch(() => undefined) }
    const authenticated = (event: Event) => { if ((event as CustomEvent<number>).detail === ownerId) save() }
    const warn = (event: BeforeUnloadEvent) => { if (pending.current.size) { save(); event.preventDefault(); event.returnValue = '' } }
    const commit = (event: Event) => { (event as CustomEvent<Promise<void>[]>).detail.push(flush()) }
    document.addEventListener('visibilitychange', save)
    window.addEventListener('online', save)
    window.addEventListener('transkrip:authenticated', authenticated)
    window.addEventListener('transkrip:flush', commit)
    window.addEventListener('beforeunload', warn)
    return () => {
      active.current = false
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', save); window.removeEventListener('online', save)
      window.removeEventListener('transkrip:authenticated', authenticated); window.removeEventListener('transkrip:flush', commit)
      window.removeEventListener('beforeunload', warn)
    }
  }, [flush, ownerId])
  return { stage, flush }
}
