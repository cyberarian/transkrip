import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { checkOllamaStatus, type OllamaRuntimeStatus } from '../ollama-status'

const initial: OllamaRuntimeStatus = { status: 'checking', checkedAt: null, latencyMs: null, modelCount: 0, recommendedModelAvailable: false, reason: null }

function copy(status: OllamaRuntimeStatus) {
  if (status.status === 'checking') return { title: 'Memeriksa Ollama…', detail: 'Loopback 127.0.0.1:11434' }
  if (status.status === 'connected') return { title: 'Ollama terhubung', detail: status.recommendedModelAvailable ? `${status.modelCount} model · Sahabat-AI siap` : `${status.modelCount} model · rekomendasi belum ada` }
  const reason = status.reason === 'timeout' ? 'pemeriksaan melewati batas waktu' : status.reason === 'invalid_response' ? 'respons lokal tidak valid' : status.reason === 'http_error' ? 'layanan merespons dengan kesalahan' : 'layanan lokal tidak ditemukan'
  return { title: 'Ollama tidak terhubung', detail: `${reason} · klik untuk periksa ulang` }
}

export function OllamaStatus() {
  const [status, setStatus] = useState<OllamaRuntimeStatus>(initial)
  useEffect(() => { let active = true; checkOllamaStatus().then(value => { if (active) setStatus(value) }).catch(() => { if (active) setStatus({ ...initial, status: 'unavailable', checkedAt: new Date().toISOString(), reason: 'unreachable' }) }); return () => { active = false } }, [])
  const retry = async () => { setStatus(value => ({ ...value, status: 'checking', latencyMs: null, reason: null })); try { setStatus(await checkOllamaStatus()) } catch { setStatus({ ...initial, status: 'unavailable', checkedAt: new Date().toISOString(), reason: 'unreachable' }) } }
  const label = copy(status)
  return <button type="button" className={`ollama-session-status is-${status.status}`} onClick={() => void retry()} disabled={status.status === 'checking'} title="Periksa koneksi Ollama lokal">
    <Icon name={status.status === 'checking' ? 'refresh' : 'chip'}/><span aria-live="polite"><b>{label.title}</b><small>{label.detail}</small></span>
  </button>
}
