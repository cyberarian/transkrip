import { describe, expect, it } from 'vitest'
import { clampZoom, playbackFollowScrollLeft, scrollLeftForZoom } from './waveform-navigation'

describe('waveform navigation', () => {
  it('clamps zoom to supported limits', () => {
    expect(clampZoom(0)).toBe(1)
    expect(clampZoom(5)).toBe(5)
    expect(clampZoom(100)).toBe(16)
  })

  it('keeps the source time under the anchor stationary while zooming', () => {
    expect(scrollLeftForZoom(200, 500, 1000, 2000, 0.5)).toBe(650)
  })

  it('clamps scrolling when the anchored time falls outside the new bounds', () => {
    expect(scrollLeftForZoom(700, 500, 1000, 500, 0.5)).toBe(0)
    expect(scrollLeftForZoom(900, 500, 1000, 4000, 0.5)).toBe(3500)
  })

  it('leaves the playhead in the safe area until playback reaches its edge', () => {
    expect(playbackFollowScrollLeft(500, 800, 1000, 4000)).toBeNull()
    expect(playbackFollowScrollLeft(0, 1250, 1000, 4000)).toBe(530)
  })

  it('keeps the playhead visible at the start and end of a recording', () => {
    expect(playbackFollowScrollLeft(0, 50, 1000, 4000)).toBe(0)
    expect(playbackFollowScrollLeft(3000, 3900, 1000, 4000)).toBe(3000)
  })
})
