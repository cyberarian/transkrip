import { describe, expect, it } from 'vitest'
import { formatSrtTime, formatTime } from './audio'

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
