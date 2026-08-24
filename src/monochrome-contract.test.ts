import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sources = [
  new URL('./styles.css', import.meta.url),
  new URL('./components/Waveform.tsx', import.meta.url),
  new URL('../index.html', import.meta.url),
].map(url => readFileSync(url, 'utf8')).join('\n')

function hueOf(hex: string) {
  const [red, green, blue] = hex.match(/[a-f\d]{2}/gi)!.map(value => Number.parseInt(value, 16) / 255)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return null
  const hue = max === red
    ? ((green - blue) / delta) % 6
    : max === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4
  return (hue * 60 + 360) % 360
}

describe('monochromatic UI contract', () => {
  it('keeps every six-digit UI hex in the blue hue family', () => {
    const colors = [...sources.matchAll(/#[a-f\d]{6}\b/gi)].map(match => match[0])
    expect(colors.length).toBeGreaterThan(20)
    for (const color of colors) {
      const hue = hueOf(color)
      expect(hue, color).not.toBeNull()
      expect(hue!, color).toBeGreaterThanOrEqual(205)
      expect(hue!, color).toBeLessThanOrEqual(225)
    }
  })
})
