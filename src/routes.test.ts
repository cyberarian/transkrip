import { describe, expect, it } from 'vitest'
import { routeFromHash } from './routes'

describe('routeFromHash', () => {
  it('opens the landing page for the empty URL', () => {
    expect(routeFromHash('')).toBe('landing')
    expect(routeFromHash('#')).toBe('landing')
  })

  it('opens the transcription workspace for its stable hash route', () => {
    expect(routeFromHash('#workspace')).toBe('workspace')
  })

  it('opens the About page for its stable hash route', () => {
    expect(routeFromHash('#about')).toBe('about')
  })

  it('opens Settings for its stable hash route', () => {
    expect(routeFromHash('#settings')).toBe('settings')
  })

  it('opens the transcription table for its stable hash route', () => {
    expect(routeFromHash('#tasks')).toBe('tasks')
  })

  it('opens local document analysis for its stable hash route', () => {
    expect(routeFromHash('#analysis')).toBe('analysis')
    expect(routeFromHash('#analysis?source=7')).toBe('analysis')
  })

  it('opens administrator account management for its stable hash route', () => {
    expect(routeFromHash('#users')).toBe('users')
  })

  it('keeps unknown hashes on the landing page', () => {
    expect(routeFromHash('#unknown')).toBe('landing')
  })
})
