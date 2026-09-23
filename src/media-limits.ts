export const MAX_LOCAL_MEDIA_BYTES = 2 * 1024 ** 3
export const MEDIA_SAMPLE_RATE = 16000
export const MAX_MEDIA_SECONDS = 4 * 60 * 60
export const MAX_PREPARED_BYTES = MEDIA_SAMPLE_RATE * MAX_MEDIA_SECONDS * 4
export const MEDIA_PREPARATION_TIMEOUT_MS = 10 * 60 * 1000

export function isLoopbackHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase())
}
