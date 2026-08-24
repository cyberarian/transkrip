export const DIARIZATION_MODES = ['auto', 'required', 'off'] as const
export type DiarizationMode = typeof DIARIZATION_MODES[number]
export type DiarizationReadiness = 'ready' | 'unavailable'
export type DiarizationHealthSnapshot = {
  status: 'checking' | DiarizationReadiness
  checkedAt: string | null
  latencyMs: number | null
  reason: 'unreachable' | 'http_error' | 'invalid_response' | 'timeout' | null
}

export function isDiarizationMode(value: unknown): value is DiarizationMode {
  return typeof value === 'string' && DIARIZATION_MODES.includes(value as DiarizationMode)
}

export function decideDiarization(mode: DiarizationMode, readiness: DiarizationReadiness) {
  if (mode === 'off') return { canStart: true, shouldUpload: false }
  if (readiness === 'ready') return { canStart: true, shouldUpload: true }
  return { canStart: mode !== 'required', shouldUpload: false }
}

export async function prepareDiarization(mode: DiarizationMode, check: () => Promise<DiarizationReadiness>) {
  if (mode === 'off') return decideDiarization(mode, 'unavailable')
  try { return decideDiarization(mode, await check()) }
  catch { return decideDiarization(mode, 'unavailable') }
}

export function parseDiarizationHealthSnapshot(value: unknown): DiarizationHealthSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Status diarization lokal tidak valid.')
  const snapshot = value as Record<string, unknown>
  if (!['checking', 'ready', 'unavailable'].includes(String(snapshot.status))
    || !(snapshot.checkedAt === null || typeof snapshot.checkedAt === 'string')
    || !(snapshot.latencyMs === null || (typeof snapshot.latencyMs === 'number' && Number.isFinite(snapshot.latencyMs) && snapshot.latencyMs >= 0))
    || ![null, 'unreachable', 'http_error', 'invalid_response', 'timeout'].includes(snapshot.reason as null | string)) throw new Error('Status diarization lokal tidak valid.')
  return snapshot as DiarizationHealthSnapshot
}
