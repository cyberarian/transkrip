import { describe, expect, it, vi } from 'vitest'
import { formatSrtTime, formatTime, readAudioBytes, isVideoFile } from './audio'

describe('readAudioBytes', () => {
  it('returns the exact file bytes and reports monotonic progress', async () => {
    const payload = new TextEncoder().encode('transkrip audio bytes').buffer as ArrayBuffer
    const file = new File([payload], 'rapat.wav', { type: 'audio/wav' })
    const onProgress = vi.fn()
    const bytes = await readAudioBytes(file, onProgress)
    expect(bytes.byteLength).toBe(file.size)
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array(payload))
    expect(onProgress).toHaveBeenCalled()
    const percents = onProgress.mock.calls.map(call => call[0] as number)
    expect(percents[percents.length - 1]).toBeLessThanOrEqual(99)
    expect([...percents].sort((a, b) => a - b)).toEqual(percents)
  })
})

describe('formatTime', () => {
  it('formats ordinary and hour-long timestamps', () => {
    expect(formatTime(65.9)).toBe('01:05')
    expect(formatTime(3665.125, true)).toBe('01:01:05.125')
  })

  it('fails closed for negative and non-finite values', () => {
    expect(formatTime(-1)).toBe('00:00')
    expect(formatTime(Number.NaN, true)).toBe('00:00.000')
  })

  it('carries detailed millisecond rounding into the next minute', () => {
    expect(formatTime(59.9996, true)).toBe('01:00.000')
  })
})

describe('formatSrtTime', () => {
  it('carries rounded milliseconds into the next second', () => {
    expect(formatSrtTime(59.9996)).toBe('00:01:00,000')
  })

  it('never emits negative or non-finite timestamps', () => {
    expect(formatSrtTime(-12)).toBe('00:00:00,000')
    expect(formatSrtTime(Number.POSITIVE_INFINITY)).toBe('00:00:00,000')
  })
})

describe('isVideoFile', () => {
  it('detects video files by extension', () => {
    expect(isVideoFile(new File([], 'video.mp4'))).toBe(true)
    expect(isVideoFile(new File([], 'video.mov'))).toBe(true)
    expect(isVideoFile(new File([], 'video.webm'))).toBe(true)
    expect(isVideoFile(new File([], 'video.avi'))).toBe(true)
    expect(isVideoFile(new File([], 'video.mkv'))).toBe(true)
  })

  it('detects video files by MIME type', () => {
    expect(isVideoFile(new File([], '', { type: 'video/mp4' }))).toBe(true)
    expect(isVideoFile(new File([], '', { type: 'video/quicktime' }))).toBe(true)
    expect(isVideoFile(new File([], '', { type: 'video/webm' }))).toBe(true)
  })

  it('does not treat audio-only files as video', () => {
    expect(isVideoFile(new File([], '', { type: 'audio/wav' }))).toBe(false)
    expect(isVideoFile(new File([], '', { type: 'audio/mpeg' }))).toBe(false)
    expect(isVideoFile(new File([], '', { type: 'audio/mp4' }))).toBe(false)
    expect(isVideoFile(new File([], 'audio.mp3'))).toBe(false)
    expect(isVideoFile(new File([], 'audio.wav'))).toBe(false)
  })

  it('ignores query strings in filenames', () => {
    expect(isVideoFile(new File([], 'video.mp4?token=123'))).toBe(true)
    expect(isVideoFile(new File([], 'video.mp4#seek=10'))).toBe(true)
  })
})
