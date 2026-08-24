export type AsrModelRequirement = {
  file: string
  label: string
  sizeMb: number
  minimumMemoryGb: number
  recommendedMemoryGb: number
  description: string
}

const MODELS: AsrModelRequirement[] = [
  { file: 'ggml-base.bin', label: 'Base multilingual', sizeMb: 141, minimumMemoryGb: 4, recommendedMemoryGb: 8, description: 'cepat · ID + EN' },
  { file: 'ggml-small-q5_1.bin', label: 'Small Q5_1 multilingual', sizeMb: 181, minimumMemoryGb: 6, recommendedMemoryGb: 8, description: 'seimbang · ID + EN' },
  { file: 'cahya-ggml-medium-q5_0.bin', label: 'Cahya Medium Q5_0 · Bahasa Indonesia', sizeMb: 514, minimumMemoryGb: 8, recommendedMemoryGb: 16, description: 'akurasi Indonesia · CPU intensif' },
]

export const ASR_MODELS = Object.freeze(MODELS)

export function getAsrModel(file: string) {
  const model = MODELS.find(candidate => candidate.file === file)
  if (!model) throw new Error(`Persyaratan model ${file} tidak dikenal.`)
  return model
}

export function assessModelMemory(file: string, deviceMemoryGb?: number) {
  const model = getAsrModel(file)
  if (!Number.isFinite(deviceMemoryGb)) return { level: 'unknown' as const, model }
  if ((deviceMemoryGb as number) < model.minimumMemoryGb) return { level: 'blocked' as const, model }
  if ((deviceMemoryGb as number) < model.recommendedMemoryGb) return { level: 'supported' as const, model }
  return { level: 'recommended' as const, model }
}

export function browserDeviceMemoryGb(navigatorValue: Navigator) {
  const value = (navigatorValue as Navigator & { deviceMemory?: number }).deviceMemory
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}
