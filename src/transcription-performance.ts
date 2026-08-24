export type TranscriptionProfile = {
  threads: number
  chunkSeconds: number
  language: string
  name: string
}

const CAHYA_MEDIUM = 'cahya-ggml-medium-q5_0.bin'

export function getTranscriptionProfile(modelName: string, logicalCores: number, language: string, threaded: boolean): TranscriptionProfile {
  const reportedCores = Number.isFinite(logicalCores) && logicalCores > 0 ? Math.floor(logicalCores) : 5
  // Leave part of the reported logical-CPU budget to the browser and local services.
  // Medium inference has a lower ceiling because additional workers add contention.
  const threadCeiling = modelName === CAHYA_MEDIUM ? 6 : 8
  const cpuThreads = Math.ceil(reportedCores * .75)
  const threads = threaded ? Math.max(1, Math.min(threadCeiling, cpuThreads)) : 1
  const cahya = modelName === CAHYA_MEDIUM

  return {
    threads,
    chunkSeconds: cahya ? 60 : 30,
    language: cahya && language === 'auto' ? 'id' : language,
    name: cahya ? 'Cahya Medium seimbang' : 'Multilingual seimbang',
  }
}
