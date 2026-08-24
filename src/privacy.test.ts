import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readProjectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('local privacy boundary', () => {
  it('does not load third-party page assets', () => {
    const index = readProjectFile('index.html')
    const styles = readProjectFile('src/styles.css')

    expect(index).not.toMatch(/(?:src|href)=["']https?:\/\//i)
    expect(styles).not.toMatch(/@import\s+url\(["']?https?:\/\//i)
  })

  it('ships a restrictive content security policy', () => {
    const headers = readProjectFile('public/_headers')
    const pageHeaders = headers.split('\n\n')[0]

    expect(pageHeaders).toContain("default-src 'self'")
    expect(pageHeaders).toContain("connect-src 'self'")
    expect(pageHeaders).toContain("object-src 'none'")
    expect(pageHeaders).toContain('Strict-Transport-Security: max-age=31536000; includeSubDomains')
    expect(pageHeaders).not.toContain("'unsafe-inline'")
    expect(pageHeaders).not.toContain("'unsafe-eval'")
    expect(headers).toContain('/whisper/engine-worker.js')
    expect(headers).toContain("script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'")
  })

  it('keeps the optional language-model endpoint same-origin', () => {
    const correction = readProjectFile('src/correction.ts')

    expect(correction).toContain("fetch('/ollama/api/chat'")
    expect(correction).not.toMatch(/fetch\(["']https?:\/\//i)
  })

  it('does not publish local model download-cache metadata', () => {
    const modelsDirectory = new URL('../public/models/', import.meta.url)
    const publicModelFiles = readdirSync(modelsDirectory, { recursive: true })
      .filter(entry => statSync(new URL(String(entry), modelsDirectory)).isFile())

    expect(publicModelFiles.some(entry => String(entry).startsWith('.cache/'))).toBe(false)
  })
})
