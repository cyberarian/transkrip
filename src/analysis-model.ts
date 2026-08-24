import { DEFAULT_CORRECTION_MODEL, isValidOllamaModelName } from './correction-model'

export const ANALYSIS_MODEL_STORAGE_KEY = 'transkrip.analysis-model'

export function getAnalysisModel(storage: Pick<Storage, 'getItem'> = window.localStorage) {
  try {
    const saved = storage.getItem(ANALYSIS_MODEL_STORAGE_KEY)
    return isValidOllamaModelName(saved) ? saved : DEFAULT_CORRECTION_MODEL
  } catch { return DEFAULT_CORRECTION_MODEL }
}

export function saveAnalysisModel(model: string, storage: Pick<Storage, 'setItem'> = window.localStorage) {
  if (!isValidOllamaModelName(model)) throw new Error('Nama model Ollama tidak valid.')
  try { storage.setItem(ANALYSIS_MODEL_STORAGE_KEY, model) }
  catch { throw new Error('Pilihan model analisis tidak dapat disimpan di browser ini.') }
}
