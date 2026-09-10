import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { retainWorkspace } from './workspace-lifecycle'

const rootSource = readFileSync(new URL('./Root.tsx', import.meta.url), 'utf8')

describe('workspace route lifecycle', () => {
  it('does not create the heavy workspace before it is first opened', () => {
    expect(retainWorkspace(false, 'landing')).toBe(false)
    expect(retainWorkspace(false, 'settings')).toBe(false)
  })

  it('keeps the workspace mounted after navigation to another app route', () => {
    const opened = retainWorkspace(false, 'workspace')
    expect(opened).toBe(true)
    expect(retainWorkspace(opened, 'tasks')).toBe(true)
    expect(retainWorkspace(opened, 'settings')).toBe(true)
    expect(retainWorkspace(opened, 'about')).toBe(true)
  })

  it('renders the retained workspace as a hidden surface instead of replacing it', () => {
    expect(rootSource).toContain('retainWorkspace(workspaceOpened, safeRoute)')
    expect(rootSource).toContain("hidden={safeRoute !== 'workspace'}")
    expect(rootSource).toContain('hidden={sessionLocked} key={user.id}')
    expect(rootSource).toContain('const unauthenticated = () => { setSessionLocked(true);')
    expect(rootSource).toContain("<App ownerId={user.id} routeActive={!sessionLocked && safeRoute === 'workspace'} diarizationMode={user.diarizationMode}/>")
  })
})
