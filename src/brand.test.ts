import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const componentFiles = [
  './App.tsx',
  './components/AboutPage.tsx',
  './components/LandingPage.tsx',
  './components/LoginPage.tsx',
  './components/SettingsPage.tsx',
  './components/TasksPage.tsx',
  './components/UsersPage.tsx',
]

describe('Transkrip brand contract', () => {
  it('uses one accessible brand component instead of raw letter marks', () => {
    const brand = readFileSync(new URL('./components/Brand.tsx', import.meta.url), 'utf8')
    expect(brand).toContain('aria-hidden="true"')
    expect(brand).toContain('aria-label={label}')
    expect(brand).toContain('transkrip')

    for (const relativePath of componentFiles) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
      expect(source, relativePath).not.toContain('<span className="brand-cell">T</span>')
    }
  })

  it('ships the standalone mark as a same-origin browser icon', () => {
    const icon = new URL('../public/brand-mark.svg', import.meta.url)
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const component = readFileSync(new URL('./components/Brand.tsx', import.meta.url), 'utf8')
    expect(existsSync(icon)).toBe(true)
    const iconSource = readFileSync(icon, 'utf8')
    expect(iconSource).toContain('<title>Suara menjadi teks</title>')
    expect(iconSource.match(/<path[^>]+d="([^"]+)"/)?.[1]).toBe(component.match(/<path[^>]+d="([^"]+)"/)?.[1])
    expect(html).toContain('<link rel="icon" href="/brand-mark.svg"')
  })
})
