import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = readFileSync(new URL('./Root.tsx', import.meta.url), 'utf8')
const page = readFileSync(new URL('./components/AnalysisPage.tsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const landing = readFileSync(new URL('./components/LandingPage.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('Analysis surface contract', () => {
  it('mounts Analysis as an authenticated route', () => {
    expect(root).toContain("safeRoute === 'analysis'")
    expect(root).toContain('<AnalysisPage/>')
  })

  it('uses English navigation words while explanatory content remains Bahasa', () => {
    expect(workspace).toContain('<b>Analysis</b>')
    expect(workspace).toContain('<b>Settings</b>')
    expect(landing).toContain('href="#analysis">Analysis</a>')
    expect(page).toContain('Analisis percakapan lokal')
    expect(page).toContain('Pilih transkrip')
  })

  it('supports readiness, persisted jobs, polling, and local exports', () => {
    expect(page).toContain('checkDocetl')
    expect(page).toContain('createAnalysis')
    expect(page).toContain('window.setInterval')
    expect(page).toContain("'markdown'")
    expect(page).toContain('deleteAnalysis')
  })

  it('shows honest live activity and elapsed time for long local jobs', () => {
    expect(page).toContain('analysisActivity')
    expect(page).toContain('analysis-live-activity')
    expect(page).toContain('role="progressbar"')
    expect(page).toContain('Status diperbarui otomatis setiap 2 detik')
    expect(styles).toContain('.analysis-progress-track')
  })

  it('keeps the local-service readiness visible on phone layouts', () => {
    const phoneRules = styles.slice(styles.indexOf('@media (max-width: 600px)'))
    expect(phoneRules).not.toContain('.analysis-health { display: none; }')
  })
})
