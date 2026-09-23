import type { EngineState } from './types'

export function audioReadyMessage(engine: EngineState, resume: boolean): string {
  if (engine === 'missing') return 'Audio siap. Pilih Siapkan model untuk memuat mesin transkripsi terlebih dahulu.'
  if (engine === 'loading') return 'Audio siap. Tunggu hingga model selesai dimuat.'
  if (engine === 'error') return 'Audio siap, tetapi mesin transkripsi belum siap. Silakan muat ulang model.'
  if (engine === 'transcribing') return 'Transkripsi sedang berjalan di perangkat ini.'
  return `Audio dan model siap. Tekan ${resume ? 'Lanjutkan transkripsi' : 'Transkripsikan'} untuk menjalankan whisper.cpp secara lokal.`
}
