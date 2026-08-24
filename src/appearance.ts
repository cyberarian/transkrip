export const APPEARANCE_STORAGE_KEY = 'transkrip.appearance'

export const APPEARANCE_PRESETS = [
  { id: 'console', name: 'Evidence Console', description: 'Atkinson Hyperlegible + Chivo Mono', sample: 'Bukti tetap jelas, padat, dan mudah diperiksa.' },
  { id: 'modern', name: 'Modern Editorial', description: 'System sans + Chivo Mono', sample: 'Percakapan terasa ringan, lapang, dan kontemporer.' },
  { id: 'classic', name: 'Classic Typesetting', description: 'Old-style serif + Chivo Mono', sample: 'Naskah panjang terasa seperti halaman cetak yang tenang.' },
] as const

export type AppearanceId = typeof APPEARANCE_PRESETS[number]['id']
type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'>
type AppearanceRoot = Pick<HTMLElement, 'dataset'>

export function isAppearanceId(value: string | null): value is AppearanceId {
  return APPEARANCE_PRESETS.some(preset => preset.id === value)
}

export function getAppearance(storage: Pick<AppearanceStorage, 'getItem'> = window.localStorage): AppearanceId {
  try {
    const saved = storage.getItem(APPEARANCE_STORAGE_KEY)
    return isAppearanceId(saved) ? saved : 'console'
  } catch {
    return 'console'
  }
}

export function applyAppearance(appearance: AppearanceId, root: AppearanceRoot = document.documentElement) {
  root.dataset.appearance = appearance
}

export function saveAppearance(appearance: AppearanceId, storage: Pick<AppearanceStorage, 'setItem'> = window.localStorage, root: AppearanceRoot = document.documentElement) {
  storage.setItem(APPEARANCE_STORAGE_KEY, appearance)
  applyAppearance(appearance, root)
}
