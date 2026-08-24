import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./components/LandingPage.tsx', import.meta.url), 'utf8')

describe('landing page contract', () => {
  it('links the primary actions to the stable workspace route', () => {
    expect(source.match(/href="#workspace"/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('marks the transcript proof as illustrative and names its speaker count accurately', () => {
    expect(source).toContain('Pratinjau transkrip')
    expect(source).toContain('Ilustrasi · 2 pembicara · ID + EN')
  })

  it('changes appearance through one native radio event path', () => {
    expect(source).toContain('onChange={() => chooseAppearance(preset.id)}')
    expect(source).not.toContain('onClick={() => chooseAppearance(preset.id)}')
  })
})
