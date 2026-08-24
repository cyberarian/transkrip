export const DEFAULT_CORRECTION_MODEL = 'csalab/sahabatai1:llama3_base_Q4_K_M'
export const CORRECTION_MODEL_STORAGE_KEY = 'transkrip.correction-model'
const LEGACY_DEFAULT_CORRECTION_MODEL = 'transkrip-garuda:66a27b863a7e'

type ModelStorage = Pick<Storage, 'getItem' | 'setItem'>

export function isValidOllamaModelName(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)
}

export function getCorrectionModel(storage: Pick<ModelStorage, 'getItem'> = window.localStorage) {
  try {
    const saved = storage.getItem(CORRECTION_MODEL_STORAGE_KEY)
    if (saved === LEGACY_DEFAULT_CORRECTION_MODEL) return DEFAULT_CORRECTION_MODEL
    return isValidOllamaModelName(saved) ? saved : DEFAULT_CORRECTION_MODEL
  } catch {
    return DEFAULT_CORRECTION_MODEL
  }
}

export function saveCorrectionModel(model: string, storage: Pick<ModelStorage, 'setItem'> = window.localStorage) {
  if (!isValidOllamaModelName(model)) throw new Error('Nama model Ollama tidak valid.')
  try {
    storage.setItem(CORRECTION_MODEL_STORAGE_KEY, model)
  } catch {
    throw new Error('Pilihan model tidak dapat disimpan di browser ini.')
  }
}
