import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(new URL('./components/TasksPage.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('local task search surface', () => {
  it('offers explicit accessible search and bounded filters', () => {
    expect(page).toContain('searchTranscriptions')
    expect(page).toContain('role="search"')
    expect(page).toContain('type="search"')
    expect(page).toContain('Filter bahasa')
    expect(page).toContain('Filter status')
    expect(page).toContain('Clear')
  })

  it('renders privacy-safe excerpts and responsive search controls', () => {
    expect(page).toContain('task-search-excerpt')
    expect(styles).toContain('.tasks-search')
    expect(styles).toContain('.task-search-excerpt')
    expect(styles).toContain('@media (max-width: 600px)')
  })
})
