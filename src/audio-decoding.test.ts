import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeAudio, MAX_AUDIO_FILE_BYTES } from './audio'

afterEach(() => vi.unstubAllGlobals())

function decoder(channels: number[][], duration = channels[0].length / 16000) {
  const decode = vi.fn(async () => ({
    duration, length: channels[0].length, numberOfChannels: channels.length,
    getChannelData: (index: number) => new Float32Array(channels[index]),
  }))
  vi.stubGlobal('OfflineAudioContext', class { decodeAudioData = decode })
  return decode
}

describe('decodeAudio', () => {
  it('downmixes stereo to mono at the transcription sample rate', async () => {
    decoder([[1, 0.5, -1, 0], [0, -0.5, 1, 1]])
    const result = await decodeAudio(new ArrayBuffer(8))
    expect([...result.pcm]).toEqual([0.5, 0, 0, 0.5])
    expect(result.duration).toBe(4 / 16000)
  })

  it('decodes video containers without media playback', async () => {
    const decode = decoder([[0.25]])
    const file = new File(['video'], 'recording.mp4', { type: 'video/mp4' })
    expect((await decodeAudio(file)).pcm[0]).toBe(0.25)
    expect(decode).toHaveBeenCalledOnce()
  })

  it('reports unsupported codecs without retrying the whole file', async () => {
    const decode = decoder([[0]])
    decode.mockRejectedValueOnce(new DOMException('Unsupported codec', 'EncodingError'))
    await expect(decodeAudio(new File(['bad'], 'bad.mkv'))).rejects.toThrow('decode-audio-failed:')
    expect(decode).toHaveBeenCalledOnce()
  })

  it('rejects durations beyond four hours', async () => {
    decoder([[0]], 14401)
    await expect(decodeAudio(new ArrayBuffer(8))).rejects.toThrow('audio-duration-out-of-range')
  })

  it('checks the size before opening a decoder', async () => {
    const file = new File([], 'large.wav')
    Object.defineProperty(file, 'size', { value: MAX_AUDIO_FILE_BYTES + 1 })
    await expect(decodeAudio(file)).rejects.toThrow('audio-file-too-large')
  })
})

describe('cancelled audio preparation', () => {
  it('rejects before reading or decoding when already cancelled', async () => {
    const decode = decoder([[0]])
    const controller = new AbortController(); controller.abort()
    await expect(decodeAudio(new ArrayBuffer(8), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(decode).not.toHaveBeenCalled()
  })

  it('does not publish a native decode result after cancellation', async () => {
    const controller = new AbortController()
    const decode = decoder([[1]])
    decode.mockImplementationOnce(async () => {
      controller.abort()
      return { duration: 1, length: 1, numberOfChannels: 1, getChannelData: () => new Float32Array([1]) }
    })
    await expect(decodeAudio(new ArrayBuffer(8), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
