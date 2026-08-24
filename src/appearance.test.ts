import { describe, expect, it } from 'vitest'
import { APPEARANCE_STORAGE_KEY, applyAppearance, getAppearance, isAppearanceId, saveAppearance } from './appearance'

describe('appearance preference', () => {
  it('recognizes only supported presets', () => {
    expect(isAppearanceId('console')).toBe(true)
    expect(isAppearanceId('modern')).toBe(true)
    expect(isAppearanceId('classic')).toBe(true)
    expect(isAppearanceId('remote-font')).toBe(false)
  })

  it('uses the evidence console when storage is empty or invalid', () => {
    expect(getAppearance({ getItem: () => null })).toBe('console')
    expect(getAppearance({ getItem: () => 'unknown' })).toBe('console')
  })

  it('persists and applies a supported preset', () => {
    let savedKey = ''
    let savedValue = ''
    const root = { dataset: {} as DOMStringMap }
    saveAppearance('classic', { setItem(key, value) { savedKey = key; savedValue = value } }, root)
    expect(savedKey).toBe(APPEARANCE_STORAGE_KEY)
    expect(savedValue).toBe('classic')
    expect(root.dataset.appearance).toBe('classic')
  })

  it('can apply a preview without writing storage', () => {
    const root = { dataset: {} as DOMStringMap }
    applyAppearance('modern', root)
    expect(root.dataset.appearance).toBe('modern')
  })
})
